import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { acceptOfferSchema } from '../../schemas';
import { McpError } from '../../errors';
import { createAuthorizedPaymentIntent } from '../../../../services/stripeMarketplace';

export async function handleAcceptOffer(
  input: z.infer<typeof acceptOfferSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  // --- Role check: ONLY client can accept offers ---
  const user = await db.collection('users').findOne({ clerkId: userId });
  if (!user) throw new McpError('UNAUTHORIZED', 'Usuario no encontrado', 401);
  if (user.role !== 'client') {
    throw new McpError('FORBIDDEN', 'Solo el cliente puede aceptar ofertas. Los conductores no pueden aceptar sus propias ofertas.', 403);
  }

  // --- Validate ride exists and belongs to this client ---
  const ride = await db.collection('rides').findOne({ _id: new ObjectId(input.rideId) });
  if (!ride) throw new McpError('NOT_FOUND', 'Acarreo no encontrado', 404);
  if (ride.clientId !== userId) {
    throw new McpError('FORBIDDEN', 'No tienes permiso para aceptar ofertas en este acarreo', 403);
  }

  // --- Validate ride is in 'requested' status ---
  if (ride.status !== 'requested') {
    throw new McpError('CONFLICT', `No puedes aceptar una oferta cuando el acarreo está en estado "${ride.status}". Solo se pueden aceptar ofertas cuando el acarreo está en estado "requested".`, 409);
  }

  // --- Validate the offer exists, belongs to this ride, and is pending ---
  const offer = await db.collection('offers').findOne({ _id: new ObjectId(input.offerId) });
  if (!offer) throw new McpError('NOT_FOUND', 'Oferta no encontrada', 404);
  if (offer.rideId !== input.rideId) {
    throw new McpError('CONFLICT', 'Esta oferta no pertenece al acarreo especificado', 409);
  }
  if (offer.clientId !== userId) {
    throw new McpError('FORBIDDEN', 'Esta oferta no te pertenece', 403);
  }
  if (offer.status !== 'pending') {
    throw new McpError('CONFLICT', `No puedes aceptar una oferta que ya está en estado "${offer.status}". Solo puedes aceptar ofertas pendientes.`, 409);
  }

  // --- Atomic ride update (acts as the lock):
  // findOneAndUpdate con {status:'requested'} asegura que solo una
  // aceptación pase — la condición evita race conditions sin transacción.
  const result = await db.collection('rides').findOneAndUpdate(
    {
      _id: new ObjectId(input.rideId),
      status: 'requested'
    },
    {
      $set: {
        driverId: offer.driverId,
        finalPrice: offer.amount,
        status: 'accepted',
        chatEnabled: true,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new McpError('CONFLICT', 'El acarreo ya no está disponible para aceptar ofertas. Puede que haya sido cancelado o aceptado por otro medio.', 409);
  }

  // Store previous status for potential rollback
  const previousStatus = 'requested';

  // --- NEW: Authorize payment (capture happens later in confirm-delivery) ---
  let chargeSucceeded = false;
  let paymentIntentId: string | undefined;

  if (!result.paymentIntentId) {
    try {
      // Get client user
      const client = await db.collection('users').findOne({ clerkId: result.clientId });
      if (!client) throw new McpError('NOT_FOUND', 'Cliente no encontrado', 404);

      // Get or create Stripe customer
      let customerId = client.stripeCustomerId;
      if (!customerId) {
        // Create Stripe customer on demand (simplified - in production use ensureStripeCustomer)
        const { getStripeClient } = await import('../../../../services/stripeMarketplace');
        const stripe = getStripeClient();
        const customer = await stripe.customers.create({
          email: client.email,
          name: [client.firstName, client.lastName].filter(Boolean).join(' ') || undefined,
          metadata: { clerkId: client.clerkId },
        });
        customerId = customer.id;
        await db.collection('users').updateOne(
          { clerkId: client.clerkId },
          { $set: { stripeCustomerId: customerId } }
        );
      }

      // Get payment method from ride or user
      const stripePaymentMethodId = result.stripePaymentMethodId || client.stripePaymentMethodId;
      if (!stripePaymentMethodId) {
        throw new McpError('PAYMENT_REQUIRED', 'Cliente no tiene método de pago guardado', 400);
      }

      // Attach payment method to customer if needed
      try {
        const { getStripeClient } = await import('../../../../services/stripeMarketplace');
        const stripe = getStripeClient();
        await stripe.paymentMethods.attach(stripePaymentMethodId, { customer: customerId });
      } catch (attachError) {
        // Ignore if already attached
      }

      // Authorize the payment (but don't capture yet - will capture in confirm-delivery)
      const amountInCents = Math.round(offer.amount * 100);
      const platformFee = Math.round(amountInCents * 0.10);
      const driverAmount = Math.round(amountInCents * 0.90);

      const { getStripeClient } = await import('../../../../services/stripeMarketplace');
      const stripe = getStripeClient();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        customer: customerId,
        payment_method: stripePaymentMethodId,
        confirm: true,
        off_session: true,
        capture_method: 'manual', // Authorize only - capture in confirm-delivery
        metadata: {
          rideId: result._id.toString(),
          platformFee: platformFee.toString(),
          driverAmount: driverAmount.toString(),
        },
      }, {
        idempotencyKey: `ride:${result._id}:authorize`,
      });

      paymentIntentId = paymentIntent.id;
      chargeSucceeded = true;

      // Update ride with payment info (status will be captured in confirm-delivery)
      await db.collection('rides').updateOne(
        { _id: new ObjectId(input.rideId) },
        {
          $set: {
            paymentIntentId: paymentIntent.id,
            platformFee,
            driverAmount,
            updatedAt: new Date()
          }
        }
      );
    } catch (chargeError: any) {
      // Rollback: revert driver assignment and status
      console.error(`Error charging client for ride ${result._id}: ${chargeError.message}`);

      await db.collection('rides').updateOne(
        { _id: new ObjectId(input.rideId) },
        {
          $set: {
            driverId: undefined,
            status: previousStatus,
            chatEnabled: false,
            finalPrice: undefined,
            updatedAt: new Date()
          }
        }
      );

      throw new McpError(
        'PAYMENT_ERROR',
        'Error al procesar el pago. Tu método de pago pudo haber sido rechazado. Por favor verifica tu tarjeta e intenta nuevamente.',
        402
      );
    }
  } else {
    // Already has paymentIntentId (e.g., charged via another path)
    chargeSucceeded = true;
    paymentIntentId = result.paymentIntentId;
  }

  // --- Ride locked and charged — now accept the offer and reject others ---
  await db.collection('offers').updateOne(
    { _id: new ObjectId(input.offerId) },
    { $set: { status: 'accepted', updatedAt: new Date() } }
  );

  await db.collection('offers').updateMany(
    {
      rideId: input.rideId,
      status: 'pending',
      _id: { $ne: new ObjectId(input.offerId) }
    },
    { $set: { status: 'rejected', updatedAt: new Date() } }
  );

  // --- Build response ---
  const rideData = {
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
    chatEnabled: true,
    paymentIntentId,
    createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
    updatedAt: result.updatedAt?.toISOString?.() ?? result.updatedAt,
  };

  return { content: [{ type: 'text', text: JSON.stringify({ ride: rideData }) }] };
}