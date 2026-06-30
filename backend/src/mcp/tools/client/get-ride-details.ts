import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { getRideDetailsSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleGetRideDetails(
  input: z.infer<typeof getRideDetailsSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    // Role check: solo client o driver pueden usar esta herramienta
    const user = await db.collection('users').findOne({ clerkId: userId });
    if (!user) throw new McpError('UNAUTHORIZED', 'Usuario no encontrado', 401);
    const allowedRoles = ['client', 'driver'];
    if (!allowedRoles.includes(user.role)) {
      throw new McpError('FORBIDDEN', `No tienes permisos para usar esta herramienta. Se requiere rol: ${allowedRoles.join(' o ')}`, 403);
    }

    // Ownership check: solo el cliente propietario o el conductor asignado pueden ver detalles
    const raw = await db.collection('rides').findOne({
      _id: new ObjectId(input.rideId),
      $or: [{ clientId: userId }, { driverId: userId }],
    });
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
