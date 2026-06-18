/**
 * MCP Server — Plataforma de Acarreos
 * 
 * Entry point del servidor MCP. Inicia el server con transporte stdio
 * y registra las 10 tools para que agentes de IA (Claude, OpenCode, etc.)
 * puedan interactuar con la plataforma.
 * 
 * Uso:
 *   bun run src/index.ts
 * 
 * Configuración vía variables de entorno:
 *   MCP_API_KEY    - Token de autenticación (requerido)
 *   BACKEND_URL    - URL del backend (default: http://localhost:3000)
 *   NODE_ENV       - Entorno (default: development)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { ApiClient } from './api-client';

// Configuración desde variables de entorno
const API_KEY = process.env.MCP_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

if (!API_KEY) {
  console.error('❌ Error: MCP_API_KEY no está configurada');
  console.error('   Copia .env.example a .env y configura MCP_API_KEY');
  process.exit(1);
}

// Cliente HTTP global
const apiClient = new ApiClient({
  baseUrl: BACKEND_URL,
  apiKey: API_KEY,
});

// Crear servidor MCP
const server = new Server(
  {
    name: 'plataforma-acarreos-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// === Tool Handlers ===
// Cada handler se importa y registra aquí.

import { registerTool } from './tools/index';
import { listMyRidesHandler } from './tools/list-my-rides';
import { createRideHandler } from './tools/create-ride';
import { getRideDetailsHandler } from './tools/get-ride-details';
import { listAvailableRidesHandler } from './tools/list-available-rides';
import { getAvailableRideDetailsHandler } from './tools/get-available-ride-details';
import { sendOfferHandler } from './tools/send-offer';
// TODO: Implementar handlers para tools 7-10 en próxima sesión
// import { viewOffersHandler } from './tools/view-offers';
// import { acceptOfferHandler } from './tools/accept-offer';
// import { updateRideStatusHandler } from './tools/update-ride-status';
// import { getRideHistoryHandler } from './tools/get-ride-history';

// Importar schemas
import {
  listMyRidesSchema,
  createRideSchema,
  getRideDetailsSchema,
  listAvailableRidesSchema,
  getAvailableRideDetailsSchema,
  sendOfferSchema,
  viewOffersSchema,
  acceptOfferSchema,
  updateRideStatusSchema,
  getRideHistorySchema,
} from './schemas';

// Registrar todas las tools
registerTool({ name: 'list_my_rides', description: 'Obtiene las solicitudes de acarreo del cliente autenticado. Filtra por estado opcional.', schema: listMyRidesSchema, handler: listMyRidesHandler(apiClient) });
registerTool({ name: 'create_ride', description: 'Publica una nueva solicitud de acarreo. Requiere origen, destino, tipo de carga, descripción y precio estimado.', schema: createRideSchema, handler: createRideHandler(apiClient) });
registerTool({ name: 'get_ride_details', description: 'Muestra la información completa de un acarreo: ubicaciones, imágenes, conductor, ofertas y estado.', schema: getRideDetailsSchema, handler: getRideDetailsHandler(apiClient) });
registerTool({ name: 'list_available_rides', description: 'Encuentra acarreos disponibles cercanos a la ubicación del conductor. Usa coordenadas y radio de búsqueda.', schema: listAvailableRidesSchema, handler: listAvailableRidesHandler(apiClient) });
registerTool({ name: 'get_available_ride_details', description: 'Ve detalles completos de un acarreo disponible antes de ofertar. Incluye perfil del cliente y distancia.', schema: getAvailableRideDetailsSchema, handler: getAvailableRideDetailsHandler(apiClient) });
registerTool({ name: 'send_offer', description: 'Envía una oferta de precio para un acarreo. El conductor propone un precio y mensaje opcional.', schema: sendOfferSchema, handler: sendOfferHandler(apiClient) });
// TODO: Tools 7-10 — implementar handlers en src/tools/
// registerTool({ name: 'view_offers', ... });
// registerTool({ name: 'accept_offer', ... });
// registerTool({ name: 'update_ride_status', ... });
// registerTool({ name: 'get_ride_history', ... });

// === Handler: List Tools ===
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: 'list_my_rides', description: 'Obtiene las solicitudes de acarreo del cliente autenticado. Filtra por estado opcional.', inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['requested', 'negotiating', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled'] }, page: { type: 'number' }, limit: { type: 'number' } } } },
      { name: 'create_ride', description: 'Publica una nueva solicitud de acarreo. Requiere origen, destino, tipo de carga, descripción y precio estimado.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, type: { type: 'string' }, pickupAddress: { type: 'string' }, pickupLat: { type: 'number' }, pickupLng: { type: 'number' }, dropoffAddress: { type: 'string' }, dropoffLat: { type: 'number' }, dropoffLng: { type: 'number' }, estimatedPrice: { type: 'number' } } } },
      { name: 'get_ride_details', description: 'Muestra la información completa de un acarreo.', inputSchema: { type: 'object', properties: { rideId: { type: 'string' } }, required: ['rideId'] } },
      { name: 'list_available_rides', description: 'Encuentra acarreos disponibles cerca del conductor.', inputSchema: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' }, radiusKm: { type: 'number' } }, required: ['lat', 'lng'] } },
      { name: 'get_available_ride_details', description: 'Ve detalles de un acarreo disponible antes de ofertar.', inputSchema: { type: 'object', properties: { rideId: { type: 'string' } }, required: ['rideId'] } },
      { name: 'send_offer', description: 'Envía una oferta de precio para un acarreo.', inputSchema: { type: 'object', properties: { rideId: { type: 'string' }, price: { type: 'number' }, message: { type: 'string' } }, required: ['rideId', 'price'] } },
      // TODO: Tools 7-10 — add to ListTools when handlers are implemented
      // { name: 'view_offers', ... },
      // { name: 'accept_offer', ... },
      // { name: 'update_ride_status', ... },
      // { name: 'get_ride_history', ... },
    ],
  };
});

// === Handler: Call Tool ===
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const tool = getToolFromRegistry(name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool desconocida: ${name}`);
    }

    const parsed = tool.schema.parse(args ?? {});
    const result = await tool.handler(parsed);

    return {
      content: result.content,
    };
  } catch (error) {
    if (error instanceof McpError) {
      return {
        content: [{ type: 'text', text: JSON.stringify(error) }],
        isError: true,
      };
    }
    if (error instanceof z.ZodError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ code: 'INVALID_INPUT', message: 'Datos de entrada inválidos', details: error.errors }) }],
        isError: true,
      };
    }
    throw error;
  }
});

// Helper: obtener tool del registro
import { z } from 'zod';
const toolHandlers = new Map<string, { schema: z.ZodSchema; handler: (input: any) => Promise<{ content: { type: 'text'; text: string }[] }> }>();

function initToolHandlers() {
  toolHandlers.set('list_my_rides', { schema: listMyRidesSchema, handler: listMyRidesHandler(apiClient) });
  toolHandlers.set('create_ride', { schema: createRideSchema, handler: createRideHandler(apiClient) });
  toolHandlers.set('get_ride_details', { schema: getRideDetailsSchema, handler: getRideDetailsHandler(apiClient) });
  toolHandlers.set('list_available_rides', { schema: listAvailableRidesSchema, handler: listAvailableRidesHandler(apiClient) });
  toolHandlers.set('get_available_ride_details', { schema: getAvailableRideDetailsSchema, handler: getAvailableRideDetailsHandler(apiClient) });
  toolHandlers.set('send_offer', { schema: sendOfferSchema, handler: sendOfferHandler(apiClient) });
  // TODO: Tools 7-10 (view_offers, accept_offer, update_ride_status, get_ride_history)
}

function getToolFromRegistry(name: string) {
  return toolHandlers.get(name) ?? null;
}

initToolHandlers();

// === Inicialización del servidor ===
async function main() {
  const transport = new StdioServerTransport();

  console.error(`🚚 MCP Server — Plataforma de Acarreos v0.1.0`);
  console.error(`   Backend: ${BACKEND_URL}`);
  console.error(`   Entorno: ${NODE_ENV}`);
  console.error(`   Tools registradas: 10`);

  await server.connect(transport);

  console.error(`✅ Servidor MCP listo. Esperando conexiones...`);
}

main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
