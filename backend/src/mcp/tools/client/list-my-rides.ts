import { z } from 'zod';
import { db } from '../../../db/mongo';
import { listMyRidesSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleListMyRides(
  input: z.infer<typeof listMyRidesSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const { status, page = 1, limit = 10 } = input;
    const filter: Record<string, any> = { clientId: userId };
    if (status) filter.status = status;

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
    }));

    return { content: [{ type: 'text', text: JSON.stringify({ rides: mapped, total, page, limit }) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al listar acarreos: ' + (error as Error).message);
  }
}
