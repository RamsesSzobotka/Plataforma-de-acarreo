import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { db } from '../../db/mongo';
import { updateRideStatusSchema } from '../schemas';
import { McpError } from '../errors';

export async function handleUpdateRideStatus(
  input: z.infer<typeof updateRideStatusSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const update: Record<string, any> = { status: input.newStatus, updatedAt: new Date() };
    let expectedCurrentStatus: string;

    if (input.newStatus === 'in_progress') {
      expectedCurrentStatus = 'accepted';
      if (input.statusNote) update.statusNote = input.statusNote;
    } else if (input.newStatus === 'completed') {
      expectedCurrentStatus = 'in_progress';
      if (input.deliveryPhotoBase64) update.deliveryPhoto = { url: `data:image/jpeg;base64,${input.deliveryPhotoBase64}` };
      if (input.statusNote) update.statusNote = input.statusNote;
    } else {
      throw new McpError('INVALID_INPUT', 'Estado no válido', 400);
    }

    const result = await db.collection('rides').findOneAndUpdate(
      { _id: new ObjectId(input.rideId), driverId: userId, status: expectedCurrentStatus },
      { $set: update },
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new McpError('CONFLICT', 'No se pudo actualizar el estado. Verifica que seas el conductor asignado y que el estado actual sea el correcto.', 409);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, status: result.status, rideId: input.rideId }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al actualizar estado: ' + (error as Error).message);
  }
}
