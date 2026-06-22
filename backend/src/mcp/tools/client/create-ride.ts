import { z } from 'zod';
import { db } from '../../../db/mongo';
import { createRideSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleCreateRide(
  input: z.infer<typeof createRideSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    // Role check: solo client o driver pueden crear rides
    const user = await db.collection('users').findOne({ clerkId: userId });
    if (!user) throw new McpError('UNAUTHORIZED', 'Usuario no encontrado', 401);
    const allowedRoles = ['client', 'driver'];
    if (!allowedRoles.includes(user.role)) {
      throw new McpError('FORBIDDEN', `No tienes permisos para usar esta herramienta. Se requiere rol: ${allowedRoles.join(' o ')}`, 403);
    }

    const rideData: Record<string, any> = {
      clientId: userId,
      title: input.title,
      description: input.description,
      type: input.type.replace('electrodomésticos', 'electrodomesticos'),
      images: [],
      pickupLocation: {
        address: input.pickupAddress,
        type: 'Point',
        coordinates: [input.pickupLng, input.pickupLat],
      },
      dropoffLocation: {
        address: input.dropoffAddress,
        type: 'Point',
        coordinates: [input.dropoffLng, input.dropoffLat],
      },
      estimatedPrice: input.estimatedPrice,
      packages: input.packages,
      notes: input.notes,
      preferredDate: input.preferredDate ? new Date(input.preferredDate) : undefined,
      status: 'requested',
      chatEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('rides').insertOne(rideData);

    const ride = {
      id: result.insertedId.toString(),
      clientId: rideData.clientId,
      title: rideData.title,
      description: rideData.description,
      type: rideData.type,
      images: rideData.images,
      pickupLocation: rideData.pickupLocation,
      dropoffLocation: rideData.dropoffLocation,
      estimatedPrice: rideData.estimatedPrice,
      packages: rideData.packages,
      notes: rideData.notes,
      preferredDate: rideData.preferredDate?.toISOString?.() ?? rideData.preferredDate,
      status: rideData.status,
      chatEnabled: rideData.chatEnabled,
      createdAt: rideData.createdAt.toISOString(),
      updatedAt: rideData.updatedAt.toISOString(),
    };

    return { content: [{ type: 'text', text: JSON.stringify({ ride }) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al crear el acarreo: ' + (error as Error).message);
  }
}
