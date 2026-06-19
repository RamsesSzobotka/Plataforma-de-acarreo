import { z } from 'zod';
import { db } from '../../db/mongo';
import { listAvailableRidesSchema } from '../schemas';
import { McpError } from '../errors';

export async function handleListAvailableRides(
  input: z.infer<typeof listAvailableRidesSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  _userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const { lat, lng, radiusKm = 20, page = 1, limit = 10 } = input;

    const filter: Record<string, any> = {
      status: 'requested',
      'pickupLocation.coordinates': {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000,
        },
      },
    };

    const [rides, total] = await Promise.all([
      db.collection('rides').find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      db.collection('rides').countDocuments(filter),
    ]);

    const mapped = rides.map((r: any) => ({
      id: r._id?.toString() ?? r.id,
      title: r.title,
      type: r.type,
      status: r.status,
      estimatedPrice: r.estimatedPrice,
      finalPrice: r.finalPrice,
      pickupAddress: r.pickupLocation?.address ?? '',
      dropoffAddress: r.dropoffLocation?.address ?? '',
      createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
      distanceKm: 0,
      clientRating: 0,
    }));

    return { content: [{ type: 'text', text: JSON.stringify({ rides: mapped, total, page, limit }) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al listar acarreos disponibles: ' + (error as Error).message);
  }
}
