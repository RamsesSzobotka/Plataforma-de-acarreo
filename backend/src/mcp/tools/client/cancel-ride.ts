import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { cancelRideSchema } from '../../schemas';
import { McpError } from '../../errors';
import { canCancel } from '../../../services/ride-machine';

export async function handleCancelRide(
  input: z.infer<typeof cancelRideSchema>,
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
      throw new McpError('FORBIDDEN', 'No tienes permiso para cancelar este acarreo', 403);
    }

    const cancelCheck = canCancel(ride.status, user.role)
    if (!cancelCheck.allowed) {
      throw new McpError('CONFLICT', cancelCheck.reason || `No puedes cancelar un acarreo en estado "${ride.status}".`, 409);
    }

    const result = await db.collection('rides').findOneAndUpdate(
      { _id: new ObjectId(input.rideId) },
      {
        $set: {
          status: 'cancelled',
          cancellationReason: input.reason || 'Cancelado por el cliente',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) throw new McpError('NOT_FOUND', 'Acarreo no encontrado al cancelar', 404);

    const rideCancelled = {
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
      cancellationReason: result.cancellationReason,
      createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
      updatedAt: result.updatedAt?.toISOString?.() ?? result.updatedAt,
    };

    return { content: [{ type: 'text', text: JSON.stringify({ ride: rideCancelled }) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al cancelar acarreo: ' + (error as Error).message);
  }
}
