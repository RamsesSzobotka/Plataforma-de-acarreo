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
    const finalPrice = input.agreedPrice ?? undefined;

    const user = await db.collection('users').findOne({ clerkId: userId });
    if (!user) throw new McpError('UNAUTHORIZED', 'Usuario no encontrado', 401);
    const allowedRoles = ['client', 'driver'];
    if (!allowedRoles.includes(user.role)) {
      throw new McpError('FORBIDDEN', `No tienes permisos para usar esta herramienta. Se requiere rol: ${allowedRoles.join(' o ')}`, 403);
    }

    const result = await db.collection('rides').findOneAndUpdate(
      { _id: new ObjectId(input.rideId), clientId: userId, status: 'requested' },
      { $set: { driverId: input.driverId, status: 'accepted', finalPrice, chatEnabled: true, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new McpError('NOT_FOUND', 'Acarreo no encontrado o no está disponible para aceptar ofertas', 404);
    }

    const ride = {
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

    return { content: [{ type: 'text', text: JSON.stringify({ ride }) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al aceptar oferta: ' + (error as Error).message);
  }
}
