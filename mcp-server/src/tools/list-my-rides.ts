import { z } from 'zod';
import { ApiClient } from '../api-client';
import { McpError } from '../errors';
import { RideSummary } from '../types';
import { listMyRidesSchema } from '../schemas';

export async function handleListMyRides(
  input: z.infer<typeof listMyRidesSchema>,
  authToken: string,
  apiClient: ApiClient,
  userId: string
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const params: Record<string, string | number | undefined> = {
      clientId: userId,
      page: input.page,
      limit: input.limit,
    };
    if (input.status) params.status = input.status;

    const response = await apiClient.get<{
      data: any[];
      pagination: { page: number; limit: number; total: number };
    }>('/api/rides', params, authToken);

    const rides: RideSummary[] = (response.data || []).map((item: any) => ({
      id: item._id?.toString() ?? item.id,
      title: item.title,
      type: item.type,
      status: item.status,
      estimatedPrice: item.estimatedPrice,
      finalPrice: item.finalPrice,
      pickupAddress: item.pickupLocation?.address ?? '',
      dropoffAddress: item.dropoffLocation?.address ?? '',
      createdAt: item.createdAt?.toString() ?? new Date().toISOString(),
      clientName: item.clientName,
      driverName: item.driverName,
    }));

    const result = {
      rides,
      total: response.pagination?.total ?? rides.length,
      page: response.pagination?.page ?? input.page,
      limit: response.pagination?.limit ?? input.limit,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al listar acarreos: ' + (error as Error).message);
  }
}
