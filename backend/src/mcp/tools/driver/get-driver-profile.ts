import { z } from 'zod';
import { db } from '../../../db/mongo';
import { getDriverProfileSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleGetDriverProfile(
  input: z.infer<typeof getDriverProfileSchema>,
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

    // ── Get driver document ──────────────────────────────────────────────
    const driver = await db.collection('drivers').findOne({ userId });
    if (!driver) {
      throw new McpError('NOT_FOUND', 'Perfil de conductor no encontrado. Debes registrarte primero.', 404);
    }

    // ── Compute permissions based on verification status ─────────────────
    const isVerified = driver.verificationStatus === 'verified';
    const permissions = {
      canViewRides: isVerified,
      canProposePrice: isVerified,
      canSendMessage: isVerified,
      canStartTrip: isVerified,
      canUploadDeliveryPhoto: isVerified,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify({
        profile: {
          verificationStatus: driver.verificationStatus,
          isAvailable: driver.isAvailable,
          vehicleType: driver.vehicleType,
          plate: driver.plate,
          capacityKg: driver.capacityKg,
          rating: driver.rating ?? 0,
          totalRides: driver.totalRides ?? 0,
          permissions,
        },
      }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al obtener perfil del conductor: ' + (error as Error).message);
  }
}
