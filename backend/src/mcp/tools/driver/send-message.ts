import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../../db/mongo';
import { sendMessageSchema } from '../../schemas';
import { McpError } from '../../errors';

export async function handleSendMessage(
  input: z.infer<typeof sendMessageSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    // ── User exists ─────────────────────────────────────────────────────
    const user = await db.collection('users').findOne({ clerkId: userId });
    if (!user) throw new McpError('UNAUTHORIZED', 'Usuario no encontrado', 401);

    // ── Ride exists ─────────────────────────────────────────────────────
    let ride: any;
    try {
      ride = await db.collection('rides').findOne({ _id: new ObjectId(input.rideId) });
    } catch {
      throw new McpError('NOT_FOUND', 'Acarreo no encontrado', 404);
    }
    if (!ride) throw new McpError('NOT_FOUND', 'Acarreo no encontrado', 404);

    // ── Authorization ───────────────────────────────────────────────────
    // Cliente: debe ser el dueño del ride
    const isClient = ride.clientId === userId;
    // Conductor: debe tener una oferta (pendiente/aceptada) O ser el asignado
    const hasOffer = await db.collection('offers').findOne({
      rideId: input.rideId,
      driverId: userId,
      status: { $in: ['pending', 'accepted'] },
    });
    const isAssignedDriver = ride.driverId === userId;

    if (!isClient && !hasOffer && !isAssignedDriver) {
      throw new McpError(
        'FORBIDDEN',
        'No tienes permiso para enviar mensajes en este acarreo. Debes ser el cliente propietario, tener una oferta pendiente/aceptada o ser el conductor asignado.',
        403,
      );
    }

    // ── Create message ──────────────────────────────────────────────────
    const message = {
      rideId: input.rideId,
      senderId: userId,
      content: input.content,
      read: false,
      createdAt: new Date(),
    };

    const result = await db.collection('messages').insertOne(message);

    return {
      content: [{ type: 'text', text: JSON.stringify({
        message: {
          id: result.insertedId.toString(),
          rideId: message.rideId,
          senderId: message.senderId,
          content: message.content,
          read: message.read,
          createdAt: message.createdAt.toISOString(),
        },
      }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al enviar mensaje: ' + (error as Error).message);
  }
}
