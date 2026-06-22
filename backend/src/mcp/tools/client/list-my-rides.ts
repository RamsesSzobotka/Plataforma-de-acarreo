import { z } from 'zod';
import { db } from '../../../db/mongo';
import { listMyRidesSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleListMyRides(
  input: z.infer<typeof listMyRidesSchema>,
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

    // ── Query rides ─────────────────────────────────────────────────────
    const { status, page = 1, limit = 10 } = input;
    const filter: Record<string, any> = { clientId: userId };
    if (status) filter.status = status;

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

    // ── Bulk-resolve user names (avoid N+1) ─────────────────────────────
    const referencedIds = new Set<string>();
    for (const r of rides) {
      if (r.clientId) referencedIds.add(r.clientId);
      if (r.driverId) referencedIds.add(r.driverId);
    }

    const usersByName = new Map<string, any>();
    if (referencedIds.size > 0) {
      const found = await db
        .collection('users')
        .find({ clerkId: { $in: Array.from(referencedIds) } })
        .toArray();
      for (const u of found) {
        usersByName.set(u.clerkId, u);
      }
    }

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
      status: r.status,
      estimatedPrice: r.estimatedPrice,
      finalPrice: r.finalPrice,
      pickupAddress: r.pickupLocation?.address ?? '',
      dropoffAddress: r.dropoffLocation?.address ?? '',
      clientName: buildUserName(r.clientId ? usersByName.get(r.clientId) : undefined),
      driverName: buildUserName(r.driverId ? usersByName.get(r.driverId) : undefined),
      createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
    }));

    return {
      content: [{ type: 'text', text: JSON.stringify({ rides: mapped, total, page, limit }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al listar acarreos: ' + (error as Error).message);
  }
}
