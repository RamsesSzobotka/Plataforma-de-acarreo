import { z } from 'zod';
import { ApiClient } from '../api-client';
import { McpError } from '../errors';
import { createRideSchema } from '../schemas';
import { Ride } from '../types';

export async function handleCreateRide(
  input: z.infer<typeof createRideSchema>,
  authToken: string,
  apiClient: ApiClient,
  userId: string
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    // Transformar datos de formato plano a formato backend
    const body: Record<string, unknown> = {
      clientId: userId,
      title: input.title,
      description: input.description,
      // Normalizar: backend usa 'electrodomesticos' sin acento
      type: input.type === 'electrodomésticos' ? 'electrodomesticos' : input.type,
      images: [],
      pickupLocation: {
        address: input.pickupAddress,
        type: 'Point',
        coordinates: [input.pickupLng, input.pickupLat], // [lng, lat]
      },
      dropoffLocation: {
        address: input.dropoffAddress,
        type: 'Point',
        coordinates: [input.dropoffLng, input.dropoffLat], // [lng, lat]
      },
      estimatedPrice: input.estimatedPrice,
    };

    // Solo agregar campos opcionales si existen
    if (input.packages !== undefined) body.packages = input.packages;
    if (input.notes !== undefined) body.notes = input.notes;
    if (input.preferredDate !== undefined) body.preferredDate = input.preferredDate;

    // Verificar que el usuario tiene un método de pago antes de crear el ride
    const paymentMethod = await apiClient.get<{ hasPaymentMethod: boolean; stripePaymentMethodId: string | null }>(
      '/api/users/me/payment-method',
      undefined,
      authToken
    );
    if (!paymentMethod.hasPaymentMethod) {
      throw new McpError(
        'PAYMENT_METHOD_REQUIRED',
        'No tienes un método de pago guardado. Debes agregar uno directamente en Carglyn (tu perfil → Método de Pago). El asistente no puede agregar métodos de pago por ti.',
        400,
        false
      );
    }

    const response = await apiClient.post<Record<string, unknown>>('/api/rides', body, authToken);

    // Transformar _id → id y serializar fechas a string
    const ride: Ride = {
      id: (response._id as string)?.toString() ?? (response.id as string),
      clientId: response.clientId as string,
      driverId: response.driverId as string | undefined,
      title: response.title as string,
      description: response.description as string,
      type: response.type as Ride['type'],
      images: (response.images as Ride['images']) ?? [],
      pickupLocation: response.pickupLocation as Ride['pickupLocation'],
      dropoffLocation: response.dropoffLocation as Ride['dropoffLocation'],
      estimatedPrice: response.estimatedPrice as number,
      finalPrice: response.finalPrice as number | undefined,
      packages: response.packages as number | undefined,
      notes: response.notes as string | undefined,
      preferredDate: (response.preferredDate as string)?.toString(),
      status: response.status as Ride['status'],
      deliveryPhoto: response.deliveryPhoto as Ride['deliveryPhoto'],
      cancellationReason: response.cancellationReason as string | undefined,
      createdAt: (response.createdAt as string)?.toString() ?? new Date().toISOString(),
      updatedAt: (response.updatedAt as string)?.toString() ?? new Date().toISOString(),
    };

    return {
      content: [{ type: 'text', text: JSON.stringify({ ride }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al crear el acarreo: ' + (error as Error).message);
  }
}
