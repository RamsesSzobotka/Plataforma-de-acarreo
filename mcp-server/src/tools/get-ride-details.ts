import { z } from 'zod';
import { ApiClient } from '../api-client';
import { McpError } from '../errors';
import { Ride } from '../types';
import { getRideDetailsSchema } from '../schemas';

export async function handleGetRideDetails(
  input: z.infer<typeof getRideDetailsSchema>,
  authToken: string,
  apiClient: ApiClient,
  userId: string
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const response = await apiClient.get<any>(`/api/rides/${input.rideId}`, {}, authToken);

    const raw = response.data ?? response;

    const ride: Ride = {
      id: raw._id?.toString() ?? raw.id,
      clientId: raw.clientId,
      driverId: raw.driverId,
      title: raw.title,
      description: raw.description,
      type: raw.type,
      images: raw.images ?? [],
      pickupLocation: raw.pickupLocation,
      dropoffLocation: raw.dropoffLocation,
      estimatedPrice: raw.estimatedPrice,
      finalPrice: raw.finalPrice,
      packages: raw.packages,
      notes: raw.notes,
      preferredDate: raw.preferredDate ? new Date(raw.preferredDate).toISOString() : undefined,
      status: raw.status,
      deliveryPhoto: raw.deliveryPhoto,
      cancellationReason: raw.cancellationReason,
      createdAt: raw.createdAt?.toString() ?? new Date().toISOString(),
      updatedAt: raw.updatedAt?.toString() ?? new Date().toISOString(),
    };

    return {
      content: [{ type: 'text', text: JSON.stringify({ ride }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al obtener detalles del acarreo: ' + (error as Error).message);
  }
}
