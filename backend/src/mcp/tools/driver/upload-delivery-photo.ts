import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { uploadDeliveryPhotoSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleUploadDeliveryPhoto(
  input: z.infer<typeof uploadDeliveryPhotoSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    // ── Role check ──────────────────────────────────────────────────────
    const user = await db.collection('users').findOne({ clerkId: userId });
    if (!user) throw new McpError('UNAUTHORIZED', 'Usuario no encontrado', 401);
    if (user.role !== 'driver') {
      throw new McpError('FORBIDDEN', 'Solo los conductores pueden usar esta herramienta', 403);
    }

    // ── Driver verification check ──────────────────────────────────────
    const driver = await db.collection('drivers').findOne({ userId });
    if (!driver) {
      throw new McpError('FORBIDDEN', 'Perfil de conductor no encontrado', 403);
    }
    if (driver.verificationStatus !== 'verified') {
      throw new McpError(
        'FORBIDDEN',
        `Tu cuenta aún no está verificada. Estado: '${driver.verificationStatus}'. Solo los conductores verificados pueden subir fotos de entrega.`,
        403,
      );
    }

    // ── Ride exists and is in_progress with this driver ─────────────────
    let ride: any;
    try {
      ride = await db.collection('rides').findOne({ _id: new ObjectId(input.rideId) });
    } catch {
      throw new McpError('NOT_FOUND', 'Acarreo no encontrado', 404);
    }
    if (!ride) throw new McpError('NOT_FOUND', 'Acarreo no encontrado', 404);
    if (ride.driverId !== userId) {
      throw new McpError('FORBIDDEN', 'Este acarreo no está asignado a ti', 403);
    }
    if (ride.status !== 'in_progress') {
      throw new McpError(
        'CONFLICT',
        `No puedes subir foto de entrega en estado '${ride.status}'. Solo se puede subir cuando el viaje está en progreso ('in_progress').`,
        409,
      );
    }

    // ── Photo URL validation ────────────────────────────────────────────
    if (!input.photoUrl || !input.photoUrl.startsWith('http')) {
      throw new McpError('INVALID_INPUT', 'La URL de la foto debe ser una URL válida', 400);
    }

    // ── Update ride with delivery photo ─────────────────────────────────
    // IMPORTANT: Does NOT change status to completed. Client confirms delivery.
    const result = await db.collection('rides').findOneAndUpdate(
      { _id: new ObjectId(input.rideId) },
      {
        $set: {
          deliveryPhoto: {
            url: input.photoUrl,
            publicId: input.publicId ?? '',
          },
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    return {
      content: [{ type: 'text', text: JSON.stringify({
        ride: {
          id: result._id.toString(),
          title: result.title,
          status: result.status,
          deliveryPhoto: result.deliveryPhoto,
          updatedAt: result.updatedAt?.toISOString?.() ?? result.updatedAt,
        },
        message: 'Foto de entrega subida exitosamente. Espera a que el cliente confirme la entrega.',
      }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al subir foto de entrega: ' + (error as Error).message);
  }
}
