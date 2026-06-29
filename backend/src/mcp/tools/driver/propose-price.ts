import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { proposePriceSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleProposePrice(
  input: z.infer<typeof proposePriceSchema>,
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
      throw new McpError('FORBIDDEN', 'Perfil de conductor no encontrado. Debes registrarte primero.', 403);
    }
    if (driver.verificationStatus !== 'verified') {
      throw new McpError(
        'FORBIDDEN',
        `Tu cuenta aún no está verificada. Estado actual: '${driver.verificationStatus}'. Solo los conductores verificados pueden proponer precios.`,
        403,
      );
    }

    // ── Ride exists and is available ───────────────────────────────────
    let ride: any;
    try {
      ride = await db.collection('rides').findOne({ _id: new ObjectId(input.rideId) });
    } catch {
      throw new McpError('NOT_FOUND', 'Acarreo no encontrado', 404);
    }
    if (!ride) throw new McpError('NOT_FOUND', 'Acarreo no encontrado', 404);
    if (ride.status !== 'requested') {
      throw new McpError('CONFLICT', `No puedes proponer precio en un acarreo con estado '${ride.status}'. Solo se puede proponer en acarreos en estado 'solicitado'.`, 409);
    }
    if (ride.driverId) {
      throw new McpError('CONFLICT', 'Este acarreo ya tiene un conductor asignado', 409);
    }
    if (ride.clientId === userId) {
      throw new McpError('FORBIDDEN', 'No puedes proponer precio en tu propio acarreo', 403);
    }

    // ── Amount validation ───────────────────────────────────────────────
    if (input.amount <= 0) {
      throw new McpError('INVALID_INPUT', 'El monto debe ser mayor a 0', 400);
    }

    // ── Check if driver already has a pending offer on this ride ────────
    const existingOffer = await db.collection('offers').findOne({
      rideId: input.rideId,
      driverId: userId,
      status: 'pending',
    });

    let offer: any;
    if (existingOffer) {
      // ── UPDATE existing pending offer ────────────────────────────────
      const result = await db.collection('offers').findOneAndUpdate(
        { _id: existingOffer._id },
        {
          $set: {
            amount: input.amount,
            message: input.message ?? existingOffer.message,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      );
      offer = result;
    } else {
      // ── INSERT new pending offer ────────────────────────────────────
      const newOffer = {
        rideId: input.rideId,
        clientId: ride.clientId,
        driverId: userId,
        amount: input.amount,
        message: input.message ?? '',
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await db.collection('offers').insertOne(newOffer);
      offer = { ...newOffer, _id: result.insertedId };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({
        offer: {
          id: offer._id?.toString() ?? offer.id,
          rideId: offer.rideId,
          driverId: offer.driverId,
          amount: offer.amount,
          message: offer.message ?? '',
          status: offer.status,
          createdAt: offer.createdAt?.toISOString?.() ?? offer.createdAt,
          updatedAt: offer.updatedAt?.toISOString?.() ?? offer.updatedAt,
        },
        message: existingOffer ? 'Oferta actualizada exitosamente' : 'Oferta creada exitosamente',
      }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al proponer precio: ' + (error as Error).message);
  }
}
