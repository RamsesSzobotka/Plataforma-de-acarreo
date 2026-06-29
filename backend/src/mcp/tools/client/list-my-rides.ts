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
    // Allow drivers to see rides where they are the assigned driver, not just client rides
    const filter: Record<string, any> = { $or: [{ clientId: userId }, { driverId: userId }] };
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

    // ── Collect all referenced IDs ──────────────────────────────────────
    const referencedIds = new Set<string>();
    for (const r of rides) {
      if (r.clientId) referencedIds.add(r.clientId);
      if (r.driverId) referencedIds.add(r.driverId);
    }

    // ── Fetch users AND drivers in parallel ─────────────────────────────
    const [users, drivers] = await Promise.all([
      referencedIds.size > 0
        ? db.collection('users').find({ clerkId: { $in: Array.from(referencedIds) } }).toArray()
        : [],
      db
        .collection('drivers')
        .find({
          userId: { $in: rides.filter((r: any) => r.driverId).map((r: any) => r.driverId) },
        })
        .toArray(),
    ]);

    const usersByClerkId = new Map((users as any[]).map((u) => [u.clerkId, u]));
    const driversByUserId = new Map((drivers as any[]).map((d) => [d.userId, d]));

    function buildUserName(u: any): string {
      if (!u) return '';
      if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
      if (u.firstName) return u.firstName;
      if (u.lastName) return u.lastName;
      return u.email ?? '';
    }

    // ── Map response ────────────────────────────────────────────────────
    const mapped = rides.map((r: any) => {
      const driver = r.driverId ? driversByUserId.get(r.driverId) : null;
      const driverUser = r.driverId ? usersByClerkId.get(r.driverId) : null;

      return {
        id: r._id?.toString() ?? r.id,
        title: r.title,
        type: r.type,
        status: r.status,
        estimatedPrice: r.estimatedPrice,
        finalPrice: r.finalPrice,
        pickupAddress: r.pickupLocation?.address ?? '',
        dropoffAddress: r.dropoffLocation?.address ?? '',
        clientName: buildUserName(r.clientId ? usersByClerkId.get(r.clientId) : undefined),
        createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
        // Driver profile when assigned
        ...(r.driverId
          ? {
              driverId: r.driverId,
              driverName: buildUserName(driverUser),
              driverRating: driver?.rating ?? 0,
              driverTotalRides: driver?.totalRides ?? 0,
              driverImageUrl: driverUser?.imageUrl ?? null,
              driverVehicleType: driver?.vehicleType ?? null,
              driverPlate: driver?.plate ?? null,
              driverVerificationStatus: driver?.verificationStatus ?? null,
            }
          : {}),
      };
    });

    return {
      content: [{ type: 'text', text: JSON.stringify({ rides: mapped, total, page, limit }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al listar acarreos: ' + (error as Error).message);
  }
}