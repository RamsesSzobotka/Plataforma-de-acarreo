import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { acceptOfferSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleAcceptOffer(
  input: z.infer<typeof acceptOfferSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
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

    // --- Ride locked — ahora aceptamos la oferta y rechazamos las demás:
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
      createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
      updatedAt: result.updatedAt?.toISOString?.() ?? result.updatedAt,
    };

    return { content: [{ type: 'text', text: JSON.stringify({ ride: rideData }) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al aceptar oferta: ' + (error as Error).message);
  }
}