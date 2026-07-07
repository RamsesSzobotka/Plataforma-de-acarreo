import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { confirmDeliverySchema } from '../../schemas';
import { McpError } from '../../errors';
import { capturePaymentIntent, transferToDriver } from '../../../services/stripeMarketplace';
import { canTransition } from '../../../services/ride-machine';
import { Driver } from '../../../models/driver';

export async function handleConfirmDelivery(
  input: z.infer<typeof confirmDeliverySchema>,
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
      throw new McpError('FORBIDDEN', 'No tienes permiso para confirmar la entrega de este acarreo', 403);
    }

    const transitionCheck = canTransition(ride.status, 'completed', user.role)
    if (!transitionCheck.allowed) {
      throw new McpError('CONFLICT', transitionCheck.reason || `No puedes confirmar la entrega en estado "${ride.status}".`, 409);
    }

    if (!ride.deliveryPhoto) {
      throw new McpError('INVALID_INPUT', 'El conductor debe subir una foto de entrega primero', 400);
    }

    // Estado del pago
    let paymentStatus: 'paid' | 'payment_method_required' | 'failed' | 'already_processed' | 'skipped' = 'skipped';
    let paymentMessage: string | null = null;

    const update: Record<string, any> = {
      status: 'completed',
      updatedAt: new Date(),
    };

    // NEW FLOW: If ride has paymentIntentId and no transferId, capture and transfer
    if (ride.paymentIntentId && !ride.transferId) {
      try {
        // Get driver info for Stripe account
        const driver = await Driver.findOne({ userId: ride.driverId });
        if (!driver?.stripeAccountId) {
          throw new Error('El conductor no tiene cuenta de pagos configurada');
        }

        // Step 1: Capture the authorized PaymentIntent
        const capturedPI = await capturePaymentIntent(ride.paymentIntentId);
        update.chargedAt = new Date();
        update.paidAt = new Date();

        if (capturedPI.status !== 'succeeded') {
          throw new Error(`La captura quedó en estado "${capturedPI.status}" en lugar de succeeded`);
        }

        // Step 2: Transfer to driver (90%)
        const amountInCents = ride.driverAmount || Math.round((ride.finalPrice || ride.estimatedPrice) * 90);
        const transfer = await transferToDriver(
          driver.stripeAccountId,
          amountInCents,
          ride._id.toString()
        );

        update.status = 'paid';
        update.transferId = transfer.id;
        update.transferredAt = new Date();
        paymentStatus = 'paid';
        paymentMessage = `Pago capturado y transferido al conductor. ` +
          `Monto: $${(amountInCents / 100).toFixed(2)} USD. ` +
          `Transferencia: ${transfer.id}`;
      } catch (stripeError) {
        const errorMessage = (stripeError as Error).message;

        if (errorMessage.includes('payment method') || errorMessage.includes('método de pago')) {
          paymentStatus = 'payment_method_required';
          paymentMessage = 'No se pudo procesar el pago porque no tienes un método de pago guardado. ' +
            'Agrega una tarjeta desde el menú > Método de Pago.';
        } else if (errorMessage.includes('Stripe account') || errorMessage.includes('connect')) {
          paymentStatus = 'failed';
          paymentMessage = `El pago no pudo procesarse porque el conductor no tiene cuenta de cobros: ${errorMessage}`;
        } else {
          paymentStatus = 'failed';
          paymentMessage = `Error en el procesamiento del pago: ${errorMessage}`;
        }
        // Don't update status to paid if payment failed
        delete update.status;
        delete update.chargedAt;
        delete update.paidAt;
      }
    } else if (ride.transferId) {
      // Already processed - has transferId means payment was already captured and transferred
      paymentStatus = 'already_processed';
      paymentMessage = 'Este acarreo ya fue pagado y el conductor recibió su transferencia.';
    } else if (ride.status === 'paid') {
      // Legacy: already marked as paid (e.g., after webhook reconfirmation)
      paymentStatus = 'already_processed';
      paymentMessage = 'Este acarreo ya estaba marcado como pagado.';
    } else {
      // Fallback: No paymentIntentId (shouldn't happen in new flow, but handle gracefully)
      paymentStatus = 'skipped';
      paymentMessage = 'No hay PaymentIntent registrado para este acarreo. El pago puede procesarse por otro medio.';
    }

    const result = await db.collection('rides').findOneAndUpdate(
      { _id: new ObjectId(input.rideId) },
      { $set: update },
      { returnDocument: 'after' },
    );

    if (!result) throw new McpError('NOT_FOUND', 'Acarreo no encontrado al actualizar', 404);

    const updatedRide = {
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
      deliveryPhoto: result.deliveryPhoto,
      cancellationReason: result.cancellationReason,
      paymentIntentId: result.paymentIntentId,
      platformFee: result.platformFee,
      driverAmount: result.driverAmount,
      transferId: result.transferId,
      chargedAt: result.chargedAt?.toISOString?.() ?? result.chargedAt ?? null,
      transferredAt: result.transferredAt?.toISOString?.() ?? result.transferredAt ?? null,
      paidAt: result.paidAt?.toISOString?.() ?? result.paidAt ?? null,
      createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
      updatedAt: result.updatedAt?.toISOString?.() ?? result.updatedAt,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ride: updatedRide,
          payment: {
            status: paymentStatus,
            message: paymentMessage,
          },
        }),
      }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al confirmar entrega: ' + (error as Error).message);
  }
}
