import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { confirmDeliverySchema } from '../../schemas';
import { McpError } from '../../errors';
import { createMarketplaceCharge, MarketplaceStripeError } from '../../../services/stripeMarketplace';

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

    if (ride.status !== 'in_progress') {
      throw new McpError('CONFLICT', `No puedes confirmar la entrega en estado "${ride.status}". Solo se permite en "in_progress".`, 409);
    }

    if (!ride.deliveryPhoto) {
      throw new McpError('INVALID_INPUT', 'El conductor debe subir una foto de entrega primero', 400);
    }

    const update: Record<string, any> = {
      status: 'completed',
      updatedAt: new Date(),
    };

    // Estado del pago automático
    let paymentStatus: 'paid' | 'payment_method_required' | 'failed' | 'already_processed' | 'skipped' = 'skipped';
    let paymentMessage: string | null = null;

    if (ride.status === 'paid') {
      // Ya estaba pagado (ej: reconfirmación después de webhook)
      paymentStatus = 'already_processed';
      paymentMessage = 'Este acarreo ya había sido procesado como pagado.';
    } else if (ride.paymentIntentId) {
      // Ya tiene un PaymentIntent creado previamente
      paymentStatus = 'already_processed';
      paymentMessage = 'El acarreo ya tenía un intento de pago registrado.';
    } else {
      // Intentar cobro automático
      try {
        const chargeResult = await createMarketplaceCharge(input.rideId, { skipStatusCheck: true });
        update.paymentIntentId = chargeResult.paymentIntent.id;
        update.platformFee = chargeResult.platformFee;
        update.driverAmount = chargeResult.driverAmount;

        if (chargeResult.paymentIntent.status === 'succeeded') {
          update.status = 'paid';
          update.paidAt = new Date();
          paymentStatus = 'paid';
          paymentMessage = `Pago exitoso de $${(ride.finalPrice || ride.estimatedPrice).toFixed(2)} USD. Comisión de plataforma (10%): $${(chargeResult.platformFee / 100).toFixed(2)} USD.`;
        } else {
          paymentStatus = 'failed';
          paymentMessage = `El pago se procesó pero quedó en estado "${chargeResult.paymentIntent.status}". Contacta al administrador si el problema persiste.`;
        }
      } catch (stripeError) {
        const errorMessage = stripeError instanceof MarketplaceStripeError ? stripeError.message : (stripeError as Error).message;

        if (errorMessage?.toLowerCase().includes('método de pago') || errorMessage?.toLowerCase().includes('payment method')) {
          // No tiene método de pago guardado — el usuario debe agregarlo desde el frontend
          paymentStatus = 'payment_method_required';
          paymentMessage = 'No se pudo procesar el pago automático porque no tienes un método de pago guardado. Debes agregar una tarjeta desde la página de pago en Carglyn (menú > Método de Pago) y luego usar la herramienta de pago para procesar el cobro.';
        } else if (errorMessage?.toLowerCase().includes('stripe account') || errorMessage?.toLowerCase().includes('connect')) {
          paymentStatus = 'failed';
          paymentMessage = `El pago no pudo procesarse porque el conductor no tiene una cuenta de cobros configurada. Motivo: ${errorMessage}`;
        } else {
          paymentStatus = 'failed';
          paymentMessage = `El pago automático falló. Motivo: ${errorMessage}. Puedes intentar el pago manualmente desde el frontend.`;
        }
      }
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
