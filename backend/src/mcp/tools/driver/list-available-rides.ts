import { z } from 'zod';
import { db } from '../../../db/mongo';
import { listAvailableRidesSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleListAvailableRides(
  input: z.infer<typeof listAvailableRidesSchema>,
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

    // ── Get driver profile for verification status ─────────────────────
    const driver = await db.collection('drivers').findOne({ userId });
    const isVerified = driver?.verificationStatus === 'verified';
    const isSuspended = driver?.verificationStatus === 'suspended';

    // ── Suspended drivers see nothing ──────────────────────────────────
    if (isSuspended) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ rides: [], total: 0, page: input.page, limit: input.limit }) }],
      };
    }

    // ── Query available rides (status === 'requested' and no driverId) ─
    const { page = 1, limit = 10 } = input;
    const filter: Record<string, any> = {
      status: 'requested',
      driverId: { $exists: false },
    };

    const [rides, total] = await Promise.all([
      db
        .collection('rides')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('rides').countDocuments(filter),
    ]);

    // ── Get client info for each ride ──────────────────────────────────
    const clientIds = [...new Set(rides.map(r => r.clientId))];
    const clients = await db.collection('users').find({ clerkId: { $in: clientIds } }).toArray();
    const clientMap = new Map(clients.map(c => [c.clerkId, c]));

    function buildUserName(u: any): string {
      if (!u) return '';
      if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
      if (u.firstName) return u.firstName;
      if (u.lastName) return u.lastName;
      return u.email ?? '';
    }

    // ── Map response ────────────────────────────────────────────────────
    const mapped = rides.map((r: any) => ({
      id: r._id?.toString() ?? r.id,
      title: r.title,
      type: r.type,
      estimatedPrice: r.estimatedPrice,
      pickupAddress: r.pickupLocation?.address ?? '',
      dropoffAddress: r.dropoffLocation?.address ?? '',
      packages: r.packages,
      notes: r.notes ?? '',
      createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
      // canApply is false if driver is not verified
      canApply: isVerified,
    }));

    return {
      content: [{ type: 'text', text: JSON.stringify({ rides: mapped, total, page, limit }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al listar acarreos disponibles: ' + (error as Error).message);
  }
}
