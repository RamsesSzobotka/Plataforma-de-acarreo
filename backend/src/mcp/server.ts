import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError as SdkMcpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { McpError as CustomMcpError } from './errors';
import { getTool, listTools, registerTool } from './tools/index';

import { listMyRidesSchema, createRideSchema, getRideDetailsSchema, viewOffersSchema, acceptOfferSchema, confirmDeliverySchema, cancelRideSchema, rateServiceSchema } from './schemas';

import { handleListMyRides } from './tools/client/list-my-rides';
import { handleCreateRide } from './tools/client/create-ride';
import { handleGetRideDetails } from './tools/client/get-ride-details';
import { handleViewOffers } from './tools/client/view-offers';
import { handleAcceptOffer } from './tools/client/accept-offer';
import { handleConfirmDelivery } from './tools/client/confirm-delivery';
import { handleCancelRide } from './tools/client/cancel-ride';
import { handleRateService } from './tools/client/rate-service';

let toolsRegistered = false;

export function registerAllTools() {
  if (toolsRegistered) return;
  toolsRegistered = true;
  const register = (name: string, description: string, schema: any, handler: any) => {
    registerTool({ name, description, schema, handler });
  };
  // Tools registered without userId — will be injected via closure in createMcpServer
  register('list_my_rides', 'Listar mis acarreos como cliente. Filtra por estado, página y límite.', listMyRidesSchema, handleListMyRides);
  register('create_ride', 'Crear un nuevo pedido de acarreo. Requiere mínimo 1 imagen (subir antes con POST /api/upload) y método de pago guardado en el perfil.', createRideSchema, handleCreateRide);
  register('get_ride_details', 'Obtener detalles completos de un acarreo por su ID.', getRideDetailsSchema, handleGetRideDetails);
  register('view_offers', 'Ver ofertas recibidas para un acarreo.', viewOffersSchema, handleViewOffers);
  register('accept_offer', 'Aceptar la oferta de un conductor para un acarreo.', acceptOfferSchema, handleAcceptOffer);
  register('confirm_delivery', 'Confirmar la entrega de un acarreo. Cambia el estado a completado e intenta el cobro automático con el método de pago guardado. Si no hay método de pago, entrega igual pero reporta que se requiere una tarjeta.', confirmDeliverySchema, handleConfirmDelivery);
  register('cancel_ride', 'Cancelar un acarreo en estado requested o negotiating.', cancelRideSchema, handleCancelRide);
  register('rate_service', 'Calificar el servicio de un acarreo completado (1-5 estrellas). Solo disponible después del pago.', rateServiceSchema, handleRateService);
}

export function createMcpServer(clerkId: string) {
  registerAllTools();

  const mcpServer = new Server(
    { name: 'carglyn-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = listTools();
    return {
      tools: tools.map((t) => {
        const jsonSchema = zodToJsonSchema(t.schema, { target: 'jsonSchema7' }) as Record<string, unknown>;
        const { $schema, ...inputSchema } = jsonSchema;
        return {
          name: t.name,
          description: t.description,
          inputSchema: inputSchema as { type: 'object'; properties?: Record<string, unknown> },
        };
      }),
    };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const rawArgs = (args ?? {}) as Record<string, unknown>;
    try {
      const tool = getTool(name);
      if (!tool) throw new SdkMcpError(ErrorCode.MethodNotFound, `Tool desconocida: ${name}`);
      const parsed = tool.schema.parse(rawArgs);
      // clerkId comes from the closure — injected when createMcpServer(clerkId) was called
      const result = await tool.handler(parsed, undefined, undefined, clerkId);
      if (result && typeof result === 'object' && 'isError' in result && result.isError) {
        return { content: result.content, isError: true };
      }
      return { content: result.content };
    } catch (error) {
      if (error instanceof CustomMcpError) return { content: [{ type: 'text', text: JSON.stringify(error) }], isError: true };
      if (error instanceof SdkMcpError) return { content: [{ type: 'text', text: JSON.stringify(error) }], isError: true };
      if (error instanceof z.ZodError) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Datos inválidos', details: error.errors.map(e => ({ path: e.path.join('.'), message: e.message })) }) }], isError: true };
      throw error;
    }
  });

  return mcpServer;
}

export async function validateMcpToken(token: string): Promise<string | null> {
  try {
    const { compare } = await import('bcryptjs');
    const { db } = await import('../db/mongo');
    const tokens = await db.collection('mcp_tokens').find({}).toArray();
    for (const t of tokens as any[]) {
      const match = await compare(token, t.tokenHash);
      if (match) {
        const { updateTokenLastUsed } = await import('../models/mcp-token');
        await updateTokenLastUsed(t.clerkId);
        return t.clerkId;
      }
    }
    return null;
  } catch {
    return null;
  }
}
