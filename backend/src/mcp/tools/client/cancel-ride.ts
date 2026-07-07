import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { cancelRideSchema } from '../../schemas';
import { McpError } from '../../errors';
import { refundPayment, cancelPaymentIntent } from '../../../services/stripeMarketplace';
import { canCancel } from '../../../services/ride-machine';

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

    if (ride.clientId !== userId) {
      throw new McpError('FORBIDDEN', 'No tienes permiso para cancelar este acarreo', 403);
    }

    // NEW: Check if payment was charged but not yet transferred - allows client to cancel with refund
    const hasPaymentIntent = !!(ride.paymentIntentId && !ride.transferId);
    const cancelCheck = canCancel(ride.status, user.role, hasPaymentIntent);
    if (!cancelCheck.allowed) {
      throw new McpError('CONFLICT', cancelCheck.reason || `No puedes cancelar un acarreo en estado "${ride.status}".`, 409);
    }

    // NEW FLOW: Check if payment was authorized but not yet transferred
    let refundStatus: 'none' | 'refunded' | 'canceled' | 'rejected' | 'not_applicable' = 'not_applicable';
    let refundMessage: string | null = null;

    if (ride.transferId) {
      // Money was already transferred to driver - cannot cancel, must go through admin
      throw new McpError(
        'CONFLICT',
        'Este acarreo ya tiene una transferencia al conductor confirmada. ' +
        'Las cancelaciones después de transferencia deben gestionarse con el administrador.',
        409
      );
    }

    if (ride.paymentIntentId && !ride.transferId) {
      // Payment was authorized but not captured/transferred - refund or cancel the PI
      try {
        // Try to cancel the PaymentIntent first (more efficient than refund)
        await cancelPaymentIntent(ride.paymentIntentId);
        refundStatus = 'canceled';
        refundMessage = `PaymentIntent ${ride.paymentIntentId} cancelado. No se realizó ningún cargo.`;
      } catch (cancelError) {
        // If cancel fails (e.g., already captured), try refund instead
        const errorMessage = (cancelError as Error).message;
        if (errorMessage.includes('already been captured') || errorMessage.includes('succeeded')) {
          // Payment was already captured somehow - create a refund
          const refundResult = await refundPayment(
            ride.paymentIntentId,
            input.reason || 'Cancelado por el cliente antes de entrega'
          );
          refundStatus = 'refunded';
          refundMessage = `Reembolso creado: ${refundResult.refundId}. El cargo será revertido a la tarjeta del cliente.`;
        } else {
          // Other error - let the user know but still cancel the ride
          refundStatus = 'rejected';
          refundMessage = `No se pudo procesar el pago automáticamente: ${errorMessage}. ` +
            `Contacta al administrador para resolves el PaymentIntent ${ride.paymentIntentId}.`;
        }
      }
    }

    // Build the update object with refund info if applicable
    const updateSet: Record<string, any> = {
      status: 'cancelled',
      cancellationReason,
      updatedAt: new Date(),
    };

    // Include refund info if payment was processed
    if (refundStatus === 'canceled') {
      updateSet.refundId = `canceled_${ride.paymentIntentId}`;
      updateSet.refundedAt = new Date();
      updateSet.refundReason = 'PaymentIntent canceled - no charge was made';
    } else if (refundStatus === 'refunded' && refundResult?.refundId) {
      updateSet.refundId = refundResult.refundId;
      updateSet.refundedAt = new Date();
      updateSet.refundReason = input.reason || 'Cancelado por el cliente antes de entrega';
    }

    const result = await db.collection('rides').findOneAndUpdate(
      { _id: new ObjectId(input.rideId) },
      { $set: updateSet },
      { returnDocument: 'after' },
    );

    if (!result) throw new McpError('NOT_FOUND', 'Acarreo no encontrado al cancelar', 404);

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

    // Include refund info if applicable
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
