import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { cancelRideSchema } from '../../schemas';
import { McpError } from '../../errors';
import { refundPayment, cancelPaymentIntent } from '../../../services/stripeMarketplace';
import { canCancel } from '../../../services/ride-machine';
import { addRidePickupLocation, removeRidePickupLocation } from '../../../services/redis';

export async function handleCancelRide(
  input: z.infer<typeof cancelRideSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const user = await db.collection('users').findOne({ clerkId: userId });
    if (!user) throw new McpError('UNAUTHORIZED', 'Usuario no encontrado', 401);
    const allowedRoles = ['client', 'driver'];
    if (!allowedRoles.includes(user.role)) {
      throw new McpError('FORBIDDEN', `No tienes permisos para usar esta herramienta. Se requiere rol: ${allowedRoles.join(' o ')}`, 403);
    }

    const ride = await db.collection('rides').findOne({ _id: new ObjectId(input.rideId) });
    if (!ride) throw new McpError('NOT_FOUND', 'Acarreo no encontrado', 404);

    // Ownership: client dueño o driver asignado
    const isClientOwner = ride.clientId === userId;
    const isAssignedDriver = ride.driverId === userId;
    if (!isClientOwner && !isAssignedDriver) {
      throw new McpError('FORBIDDEN', 'No tienes permiso para cancelar este acarreo', 403);
    }

    // --- DRIVER UNASSIGN: solo en accepted, vuelve a requested sin refund ---
    if (user.role === 'driver' && ride.status === 'accepted' && isAssignedDriver) {
      const updateSet: Record<string, any> = {
        status: 'requested',
        chatEnabled: false,
        updatedAt: new Date(),
      };

      const unsetFields: Record<string, string> = {
        driverId: '',
        finalPrice: '',
      };

      const result = await db.collection('rides').findOneAndUpdate(
        { _id: new ObjectId(input.rideId) },
        { $set: updateSet, $unset: unsetFields },
        { returnDocument: 'after' },
      );

      if (!result) throw new McpError('NOT_FOUND', 'Acarreo no encontrado al retirarse', 404);

      // Re-agregar al GEO porque el ride vuelve a estar disponible
      addRidePickupLocation(
        result._id.toString(),
        result.pickupLocation.coordinates[0],
        result.pickupLocation.coordinates[1],
      );

      // Marcar la oferta aceptada del driver como cancelada
      await db.collection('offers').updateOne(
        { rideId: input.rideId, driverId: userId, status: 'accepted' },
        { $set: { status: 'cancelled', updatedAt: new Date() } }
      );

      const rideData = {
        id: result._id?.toString() ?? result.id,
        clientId: result.clientId,
        title: result.title,
        description: result.description,
        type: result.type,
        images: result.images ?? [],
        pickupLocation: result.pickupLocation,
        dropoffLocation: result.dropoffLocation,
        estimatedPrice: result.estimatedPrice,
        packages: result.packages,
        notes: result.notes,
        preferredDate: result.preferredDate?.toISOString?.() ?? result.preferredDate ?? null,
        status: result.status,
        createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
        updatedAt: result.updatedAt?.toISOString?.() ?? result.updatedAt,
      };

      return { content: [{ type: 'text', text: JSON.stringify({ ride: rideData }) }] };
    }

    // --- CLIENT CANCEL: con refund automático ---
    if (!isClientOwner) {
      throw new McpError('FORBIDDEN', 'No tienes permiso para cancelar este acarreo', 403);
    }

    const hasPaymentIntent = !!(ride.paymentIntentId && !ride.transferId);
    const cancelCheck = canCancel(ride.status, user.role, hasPaymentIntent);
    if (!cancelCheck.allowed) {
      throw new McpError('CONFLICT', cancelCheck.reason || `No puedes cancelar un acarreo en estado "${ride.status}".`, 409);
    }

    let refundStatus: 'none' | 'refunded' | 'canceled' | 'rejected' | 'not_applicable' = 'not_applicable';
    let refundMessage: string | null = null;
    let refundResultId: string | null = null;

    if (ride.transferId) {
      throw new McpError(
        'CONFLICT',
        'Este acarreo ya tiene una transferencia al conductor confirmada. ' +
        'Las cancelaciones después de transferencia deben gestionarse con el administrador.',
        409
      );
    }

    if (ride.paymentIntentId && !ride.transferId) {
      try {
        await cancelPaymentIntent(ride.paymentIntentId);
        refundStatus = 'canceled';
        refundMessage = `PaymentIntent ${ride.paymentIntentId} cancelado. No se realizó ningún cargo.`;
      } catch (cancelError) {
        const errorMessage = (cancelError as Error).message;
        if (errorMessage.includes('already been captured') || errorMessage.includes('succeeded')) {
          const refundResult = await refundPayment(
            ride.paymentIntentId,
            input.reason || 'Cancelado por el cliente antes de entrega'
          );
          refundStatus = 'refunded';
          refundResultId = refundResult.id;
          refundMessage = `Reembolso creado: ${refundResult.id}. El cargo será revertido a la tarjeta del cliente.`;
        } else {
          refundStatus = 'rejected';
          refundMessage = `No se pudo procesar el pago automáticamente: ${errorMessage}. ` +
            `Contacta al administrador para resolver el PaymentIntent ${ride.paymentIntentId}.`;
        }
      }
    }

    const updateSet: Record<string, any> = {
      status: 'cancelled',
      cancellationReason: input.reason || 'Cancelado por el cliente',
      updatedAt: new Date(),
    };

    if (refundStatus === 'canceled') {
      updateSet.refundId = `canceled_${ride.paymentIntentId}`;
      updateSet.refundedAt = new Date();
      updateSet.refundReason = 'PaymentIntent canceled - no charge was made';
    } else if (refundStatus === 'refunded' && refundResultId) {
      updateSet.refundId = refundResultId;
      updateSet.refundedAt = new Date();
      updateSet.refundReason = input.reason || 'Cancelado por el cliente antes de entrega';
    }

    const result = await db.collection('rides').findOneAndUpdate(
      { _id: new ObjectId(input.rideId) },
      { $set: updateSet },
      { returnDocument: 'after' },
    );

    if (!result) throw new McpError('NOT_FOUND', 'Acarreo no encontrado al cancelar', 404);

    // Eliminar del GEO porque el ride ya no está disponible
    removeRidePickupLocation(result._id.toString());

    const rideCancelled = {
      id: result._id?.toString() ?? result.id,
      clientId: result.clientId,
      driverId: result.driverId,
      title: result.title,
      description: result.description,
      type: result.type,
      images: result.images ?? [],
      pickupLocation: result.pickupLocation,
      dropoffLocation: result.dropoffLocation,
      estimatedPrice: result.estimatedPrice,
      finalPrice: result.finalPrice,
      packages: result.packages,
      notes: result.notes,
      preferredDate: result.preferredDate?.toISOString?.() ?? result.preferredDate ?? null,
      status: result.status,
      cancellationReason: result.cancellationReason,
      paymentIntentId: result.paymentIntentId,
      refundId: result.refundId,
      refundedAt: result.refundedAt?.toISOString?.() ?? result.refundedAt ?? null,
      createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
      updatedAt: result.updatedAt?.toISOString?.() ?? result.updatedAt,
    };

    const response: Record<string, any> = { ride: rideCancelled };

    if (refundStatus !== 'not_applicable') {
      response.payment = {
        status: refundStatus,
        message: refundMessage,
      };
    }

    return { content: [{ type: 'text', text: JSON.stringify(response) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al cancelar acarreo: ' + (error as Error).message);
  }
}
