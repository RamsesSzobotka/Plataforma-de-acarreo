import { z } from 'zod';
import { ApiClient } from '../api-client';
import { McpError } from '../errors';
import { viewOffersSchema } from '../schemas';

export async function handleViewOffers(
  input: z.infer<typeof viewOffersSchema>,
  authToken: string,
  apiClient: ApiClient,
  userId: string
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          error: 'Endpoint GET /api/rides/:id/offers pendiente de implementar en el backend',
          details: 'El sistema de ofertas usa los endpoints: POST /api/messages/propose-price, POST /api/messages/accept-price, POST /api/messages/reject-price',
        }),
      },
    ],
    isError: true,
  };
}
