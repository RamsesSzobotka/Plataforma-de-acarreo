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

import { listMyRidesSchema, createRideSchema, getRideDetailsSchema, viewOffersSchema, acceptOfferSchema, listAvailableRidesSchema, getAvailableRideDetailsSchema, sendOfferSchema, updateRideStatusSchema, getRideHistorySchema } from './schemas';

import { handleListMyRides } from './tools/list-my-rides';
import { handleCreateRide } from './tools/create-ride';
import { handleGetRideDetails } from './tools/get-ride-details';
import { handleViewOffers } from './tools/view-offers';
import { handleAcceptOffer } from './tools/accept-offer';
import { handleListAvailableRides } from './tools/list-available-rides';
import { handleGetAvailableRideDetails } from './tools/get-available-ride-details';
import { handleSendOffer } from './tools/send-offer';
import { handleUpdateRideStatus } from './tools/update-ride-status';
import { handleGetRideHistory } from './tools/get-ride-history';

let toolsRegistered = false;

export function registerAllTools() {
  if (toolsRegistered) return;
  toolsRegistered = true;
  const register = (name: string, description: string, schema: any, handler: any) => {
    registerTool({ name, description, schema, handler });
  };
  // Tools registered without userId — will be injected via closure in createMcpServer
  register('list_my_rides', 'Listar mis acarreos como cliente. Filtra por estado, página y límite.', listMyRidesSchema, handleListMyRides);
  register('create_ride', 'Crear un nuevo pedido de acarreo.', createRideSchema, handleCreateRide);
  register('get_ride_details', 'Obtener detalles completos de un acarreo por su ID.', getRideDetailsSchema, handleGetRideDetails);
  register('view_offers', 'Ver ofertas recibidas para un acarreo.', viewOffersSchema, handleViewOffers);
  register('accept_offer', 'Aceptar la oferta de un conductor para un acarreo.', acceptOfferSchema, handleAcceptOffer);
  register('list_available_rides', 'Listar acarreos disponibles para conductores.', listAvailableRidesSchema, handleListAvailableRides);
  register('get_available_ride_details', 'Obtener detalles de un acarreo disponible.', getAvailableRideDetailsSchema, handleGetAvailableRideDetails);
  register('send_offer', 'Enviar oferta de precio para un acarreo.', sendOfferSchema, handleSendOffer);
  register('update_ride_status', 'Actualizar estado del acarreo.', updateRideStatusSchema, handleUpdateRideStatus);
  register('get_ride_history', 'Consultar historial de acarreos.', getRideHistorySchema, handleGetRideHistory);
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
        const jsonSchema = zodToJsonSchema(t.schema, { target: 'openApi3' }) as Record<string, unknown>;
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
