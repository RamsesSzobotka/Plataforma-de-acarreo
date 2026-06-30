import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { startTripSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleStartTrip(
  input: z.infer<typeof startTripSchema>,
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
        `Tu cuenta aún no está verificada. Estado: '${driver.verificationStatus}'. Solo los conductores verificados pueden iniciar viajes.`,
        403,
      );
    }

    // ── Ride exists and is assigned to this driver ─────────────────────
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
    if (ride.status !== 'accepted') {
      throw new McpError(
        'CONFLICT',
        `No puedes iniciar un viaje en estado '${ride.status}'. Solo se puede iniciar cuando el estado es 'aceptado'.`,
        409,
      );
    }

    // ── Update ride status to in_progress ───────────────────────────────
    const result = await db.collection('rides').findOneAndUpdate(
      { _id: new ObjectId(input.rideId) },
      {
        $set: {
          status: 'in_progress',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    return {
      content: [{ type: 'text', text: JSON.stringify({
        ride: {
          id: result._id.toString(),
          clientId: result.clientId,
          driverId: result.driverId,
          title: result.title,
          status: result.status,
          pickupAddress: result.pickupLocation?.address ?? '',
          dropoffAddress: result.dropoffLocation?.address ?? '',
          finalPrice: result.finalPrice,
          createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
          updatedAt: result.updatedAt?.toISOString?.() ?? result.updatedAt,
        },
        message: 'Viaje iniciado exitosamente. Recuerda compartir tu ubicación en tiempo real.',
      }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al iniciar viaje: ' + (error as Error).message);
  }
}
