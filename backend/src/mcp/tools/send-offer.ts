import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../db/mongo';
import { sendOfferSchema } from '../schemas';
import { McpError } from '../errors';

export async function handleSendOffer(
  input: z.infer<typeof sendOfferSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const ride = await db.collection('rides').findOne({ _id: new ObjectId(input.rideId) });
    if (!ride) throw new McpError('NOT_FOUND', 'Acarreo no encontrado', 404);
    if (ride.status !== 'requested') {
      throw new McpError('CONFLICT', 'El acarreo ya no está disponible para recibir ofertas', 409);
    }

    const data: Record<string, any> = {
      rideId: input.rideId,
      driverId: userId,
      clientId: ride.clientId,
      proposedPrice: input.price,
      isActive: true,
      proposalCount: 1,
      priceProposedAt: new Date(),
      createdAt: new Date(),
    };
    if (input.message) data.message = input.message;

    const existing = await db.collection('driver_contacts').findOne({ rideId: input.rideId, driverId: userId });
    if (existing) {
      await db.collection('driver_contacts').updateOne(
        { _id: existing._id },
        { $set: { proposedPrice: input.price, priceProposedAt: new Date(), isActive: true, message: input.message ?? existing.message }, $inc: { proposalCount: 1 } },
      );
    } else {
      await db.collection('driver_contacts').insertOne(data);
    }

    return { content: [{ type: 'text', text: JSON.stringify({ success: true, rideId: input.rideId, price: input.price }) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al enviar oferta: ' + (error as Error).message);
  }
}
