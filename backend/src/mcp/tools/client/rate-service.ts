import { z } from 'zod';
import { Ride } from '../../../models/ride';
import { User } from '../../../models/user';
import { rateServiceSchema } from '../../schemas';
import { McpError } from '../../errors';
import { createRatingAndUpdateAverage } from '../../../services/rating';

export async function handleRateService(
  input: z.infer<typeof rateServiceSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const user = await User.findOne({ clerkId: userId });
    if (!user) throw new McpError('UNAUTHORIZED', 'Usuario no encontrado', 401);
    const allowedRoles = ['client', 'driver'];
    if (!allowedRoles.includes(user.role)) {
      throw new McpError('FORBIDDEN', `No tienes permisos para usar esta herramienta. Se requiere rol: ${allowedRoles.join(' o ')}`, 403);
    }

    const ride = await Ride.findById(input.rideId);
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

    // Usar el servicio centralizado de calificaciones
    // createRatingAndUpdateAverage rechaza duplicados (1 review per ride)
    const ratingRecord = await createRatingAndUpdateAverage(
      input.rideId,
      userId,
      ratedId,
      role,
      input.rating,
      input.comment,
    );

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          rating: {
            id: ratingRecord._id.toString(),
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