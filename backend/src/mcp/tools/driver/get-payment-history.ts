import { z } from 'zod';
import { db } from '../../../db/mongo';
import { getPaymentHistorySchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleGetPaymentHistory(
  input: z.infer<typeof getPaymentHistorySchema>,
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

    // ── Query paid rides for this driver ────────────────────────────────
    const { page = 1, limit = 10 } = input;
    const filter: Record<string, any> = {
      driverId: userId,
      status: 'paid',
    };

    const [rides, total] = await Promise.all([
      db
        .collection('rides')
        .find(filter)
        .sort({ paidAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('rides').countDocuments(filter),
    ]);

    // ── Compute platform fee and driver amount ──────────────────────────
    // Commission: 10% platform, 90% driver
    const payments = rides.map((r: any) => {
      const finalPrice = r.finalPrice ?? 0;
      const platformFee = Math.round(finalPrice * 0.10 * 100) / 100;
      const driverAmount = Math.round(finalPrice * 0.90 * 100) / 100;
      return {
        rideId: r._id?.toString() ?? r.id,
        title: r.title,
        finalPrice,
        platformFee,
        driverAmount,
        paidAt: r.paidAt ? (typeof r.paidAt === 'string' ? r.paidAt : r.paidAt.toISOString()) : null,
      };
    });

    return {
      content: [{ type: 'text', text: JSON.stringify({ payments, total, page, limit }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al obtener historial de pagos: ' + (error as Error).message);
  }
}
