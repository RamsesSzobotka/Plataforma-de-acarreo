import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { getRideDetailsSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleGetRideDetails(
  input: z.infer<typeof getRideDetailsSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  _userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const raw = await db.collection('rides').findOne({ _id: new ObjectId(input.rideId) });
    if (!raw) throw new McpError('NOT_FOUND', 'Acarreo no encontrado', 404);

    const ride = {
      id: raw._id?.toString() ?? raw.id,
      clientId: raw.clientId,
      driverId: raw.driverId,
      title: raw.title,
      description: raw.description,
      type: raw.type,
      images: raw.images ?? [],
      pickupLocation: raw.pickupLocation,
      dropoffLocation: raw.dropoffLocation,
      estimatedPrice: raw.estimatedPrice,
      finalPrice: raw.finalPrice,
      packages: raw.packages,
      notes: raw.notes,
      preferredDate: raw.preferredDate ? new Date(raw.preferredDate).toISOString() : undefined,
      status: raw.status,
      deliveryPhoto: raw.deliveryPhoto,
      cancellationReason: raw.cancellationReason,
      createdAt: raw.createdAt?.toISOString?.() ?? raw.createdAt,
      updatedAt: raw.updatedAt?.toISOString?.() ?? raw.updatedAt,
    };

    return { content: [{ type: 'text', text: JSON.stringify({ ride }) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al obtener detalles del acarreo: ' + (error as Error).message);
  }
}
