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
    if (user.role !== 'client') {
      throw new McpError('FORBIDDEN', 'Solo los clientes pueden ver ofertas de sus acarreos', 403);
    }

    // --- Ownership check: ride must belong to this client ---
    const ride = await db.collection('rides').findOne({
      _id: new ObjectId(input.rideId),
      clientId: userId,
    });
    if (!ride) throw new McpError('NOT_FOUND', 'Acarreo no encontrado o no te pertenece', 404);

    // --- Query offers collection (NOT driver_contacts) ---
    const offers = await db.collection('offers').find({
      rideId: input.rideId,
      clientId: userId,
    }).sort({ createdAt: -1 }).toArray();

    if (offers.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ offers: [], message: 'No hay ofertas para este acarreo.' }) }],
      };
    }

    // --- Get driver info for each offer ---
    const driverIds = [...new Set(offers.map(o => o.driverId))];
    const drivers = await db.collection('users').find({ clerkId: { $in: driverIds } }).toArray();
    const driverMap = new Map(drivers.map(d => [d.clerkId, d]));

    // --- Get driver profiles (ratings, totalRides) ---
    const driverProfiles = await db.collection('drivers').find({ userId: { $in: driverIds } }).toArray();
    const driverProfileMap = new Map(driverProfiles.map(p => [p.userId, p]));

    const mappedOffers = offers.map(offer => {
      const driver = driverMap.get(offer.driverId) ?? {};
      const driverProfile = driverProfileMap.get(offer.driverId) ?? {};
      return {
        id: offer._id?.toString() ?? offer.id,
        rideId: offer.rideId,
        driverId: offer.driverId,
        amount: offer.amount,
        message: offer.message ?? '',
        status: offer.status,
        driverName: driver.firstName && driver.lastName
          ? `${driver.firstName} ${driver.lastName}`
          : driver.firstName ?? 'Conductor',
        driverRating: driverProfile.rating ?? 0,
        driverImageUrl: driver.imageUrl,
        driverTotalRides: driverProfile.totalRides ?? 0,
        createdAt: offer.createdAt?.toISOString?.() ?? offer.createdAt,
        updatedAt: offer.updatedAt?.toISOString?.() ?? offer.updatedAt,
      };
    });

    return { content: [{ type: 'text', text: JSON.stringify({ offers: mappedOffers }) }] };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al consultar ofertas: ' + (error as Error).message);
  }
}