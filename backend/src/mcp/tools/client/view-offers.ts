import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { viewOffersSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleViewOffers(
  input: z.infer<typeof viewOffersSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    // --- Role check ---
    const user = await db.collection('users').findOne({ clerkId: userId });
    if (!user) throw new McpError('UNAUTHORIZED', 'Usuario no encontrado', 401);
    const allowedRoles = ['client', 'driver'];
    if (!allowedRoles.includes(user.role)) {
      throw new McpError('FORBIDDEN', `No tienes permisos para usar esta herramienta. Se requiere rol: ${allowedRoles.join(' o ')}`, 403);
    }

    // --- Ownership check ---
    const ride = await db.collection('rides').findOne({
      _id: new ObjectId(input.rideId),
      clientId: userId,
    });
    if (!ride) throw new McpError('NOT_FOUND', 'Acarreo no encontrado o no tienes permiso para ver sus ofertas', 404);

    const contacts = await db.collection('driver_contacts').find({
      rideId: input.rideId,
      isActive: true,
    }).toArray();

    if (contacts.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ offers: [], message: 'No hay ofertas activas para este acarreo.' }) }],
      };
    }

    const driverIds = contacts.map((c: any) => c.driverId);
    const drivers = await db.collection('users').find({ clerkId: { $in: driverIds } }).toArray();
    const driverMap = new Map(drivers.map((d: any) => [d.clerkId, d]));

    const offers = contacts.map((c: any) => {
      const driver = driverMap.get(c.driverId) ?? {};
      return {
        id: c._id?.toString() ?? c.id,
        rideId: c.rideId,
        driverId: c.driverId,
        proposedPrice: c.proposedPrice,
        message: c.message,
        driverName: driver.firstName && driver.lastName ? `${driver.firstName} ${driver.lastName}` : driver.firstName ?? 'Conductor',
        driverRating: driver.rating ?? 0,
        driverImageUrl: driver.imageUrl,
        driverTotalRides: driver.totalRides ?? 0,
        createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
      };
    });

    return { content: [{ type: 'text', text: JSON.stringify({ offers }) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al consultar ofertas: ' + (error as Error).message);
  }
}
