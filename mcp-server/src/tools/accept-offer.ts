import { z } from 'zod';
import { ApiClient } from '../api-client';
import { McpError } from '../errors';
import { acceptOfferSchema } from '../schemas';

/**
 * Accept a driver's price proposal (CLIENT-side).
 *
 * This tool is for CLIENTS to accept a driver's proposed price.
 * It calls POST /api/messages/accept-price (the client endpoint),
 * NOT POST /api/rides/:id/accept (which is the driver endpoint).
 *
 * The backend retrieves the proposedPrice from the DriverContact
 * record, so agreedPrice is optional here and passed through as-is.
 */
export async function handleAcceptOffer(
  input: z.infer<typeof acceptOfferSchema>,
  authToken: string,
  apiClient: ApiClient,
  userId: string
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const body: Record<string, unknown> = {
      rideId: input.rideId,
      driverId: input.driverId,
    };

    // agreedPrice is passed to backend but not required —
    // the backend reads proposedPrice from the DriverContact record.
    if (input.agreedPrice !== undefined) {
      body.agreedPrice = input.agreedPrice;
    }

    const response = await apiClient.post<Record<string, any>>(
      '/api/messages/accept-price',
      body,
      authToken,
    );

    const rideData = response.ride ?? response;

    const ride = {
      id: String(rideData._id),
      clientId: rideData.clientId,
      driverId: rideData.driverId,
      title: rideData.title,
      description: rideData.description,
      type: rideData.type,
      images: rideData.images ?? [],
      pickupLocation: rideData.pickupLocation,
      dropoffLocation: rideData.dropoffLocation,
      estimatedPrice: rideData.estimatedPrice,
      finalPrice: rideData.finalPrice,
      packages: rideData.packages,
      notes: rideData.notes,
      preferredDate: rideData.preferredDate?.toString() ?? null,
      status: rideData.status,
      deliveryPhoto: rideData.deliveryPhoto,
      cancellationReason: rideData.cancellationReason,
      chatEnabled: true,
      createdAt: rideData.createdAt?.toString() ?? new Date().toISOString(),
      updatedAt: rideData.updatedAt?.toString() ?? new Date().toISOString(),
    };

    return {
      content: [{ type: 'text', text: JSON.stringify({ ride }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al aceptar oferta: ' + (error as Error).message);
  }
}
