import { z } from 'zod';
import { db } from '../../../db/mongo';
import { getPublicDriverProfileSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleGetPublicDriverProfile(
  input: z.infer<typeof getPublicDriverProfileSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    // ── Role check ──────────────────────────────────────────────────────
    const user = await db.collection('users').findOne({ clerkId: userId });
    if (!user) throw new McpError('UNAUTHORIZED', 'Usuario no encontrado', 401);
    const allowedRoles = ['client', 'driver'];
    if (!allowedRoles.includes(user.role)) {
      throw new McpError(
        'FORBIDDEN',
        `No tienes permisos para usar esta herramienta. Se requiere rol: ${allowedRoles.join(' o ')}`,
        403,
      );
    }

    // ── Get driver document ──────────────────────────────────────────────
    const driver = await db.collection('drivers').findOne({ userId: input.driverId });
    if (!driver) {
      throw new McpError('NOT_FOUND', 'Conductor no encontrado', 404);
    }

    // ── Get user document for name and imageUrl ─────────────────────────
    const driverUser = await db.collection('users').findOne({ clerkId: input.driverId });

    function buildUserName(u: any): string {
      if (!u) return '';
      if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
      if (u.firstName) return u.firstName;
      if (u.lastName) return u.lastName;
      return u.email ?? '';
    }

    const name = buildUserName(driverUser);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            driverId: input.driverId,
            name,
            imageUrl: driverUser?.imageUrl ?? null,
            rating: driver.rating ?? 0,
            totalRides: driver.totalRides ?? 0,
            vehicleType: driver.vehicleType,
            plate: driver.plate,
            verificationStatus: driver.verificationStatus,
            isAvailable: driver.isAvailable,
          }),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      'BACKEND_ERROR',
      'Error al obtener perfil público del conductor: ' + (error as Error).message,
    );
  }
}