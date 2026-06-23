import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { rateServiceSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleRateService(
  input: z.infer<typeof rateServiceSchema>,
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

    const isClient = ride.clientId === userId;
    const isDriver = ride.driverId === userId;
    if (!isClient && !isDriver) {
      throw new McpError('FORBIDDEN', 'No eres participante de este acarreo', 403);
    }

    if (ride.status !== 'paid') {
      throw new McpError('CONFLICT', `No puedes calificar un acarreo en estado "${ride.status}". Solo se permite después del pago.`, 409);
    }

    const ratedId = isClient ? ride.driverId : ride.clientId;
    if (!ratedId) {
      throw new McpError('INVALID_INPUT', 'No hay otra parte para calificar en este acarreo', 400);
    }

    const role = isClient ? 'driver' : 'client';

    const ratingRecord = {
      rideId: input.rideId,
      raterId: userId,
      ratedId,
      role,
      rating: input.rating,
      comment: input.comment || null,
      createdAt: new Date(),
    };

    const result = await db.collection('ratings').insertOne(ratingRecord);

    if (role === 'driver') {
      try {
        const agg = await db.collection('ratings').aggregate([
          { $match: { ratedId, role: 'driver' } },
          { $group: { _id: '$ratedId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]).toArray();

        if (agg && agg.length > 0) {
          const { avg, count } = agg[0];
          await db.collection('drivers').updateOne(
            { userId: ratedId },
            { $set: { rating: Number((avg as number).toFixed(2)), totalRides: count, updatedAt: new Date() } },
          );
        }
      } catch (aggError) {
        console.error('Error actualizando promedio de driver:', aggError);
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          rating: {
            id: result.insertedId.toString(),
            rideId: ratingRecord.rideId,
            raterId: ratingRecord.raterId,
            ratedId: ratingRecord.ratedId,
            role: ratingRecord.role,
            rating: ratingRecord.rating,
            comment: ratingRecord.comment,
            createdAt: ratingRecord.createdAt.toISOString(),
          },
        }),
      }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al calificar servicio: ' + (error as Error).message);
  }
}
