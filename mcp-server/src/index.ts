/**
 * MCP Server — Plataforma de Acarreos
 * 
 * Entry point del servidor MCP. Inicia el server con transporte stdio
 * y registra las tools para que agentes de IA (Claude, OpenCode, etc.)
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
  McpError as SdkMcpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { ApiClient } from './api-client';
import { McpError as CustomMcpError } from './errors';

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

// Helper: decodificar JWT de Clerk para extraer userId (clerkId/sub)
function getUserIdFromToken(token: string): string {
  try {
    const payload = token.split('.')[1];
    // JWT usa base64url (con - y _ en vez de + y /)
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(b64, 'base64').toString();
    const json = JSON.parse(decoded);
    if (!json.sub) {
      throw new Error('Missing sub claim');
    }
    return json.sub as string;
  } catch {
    throw new CustomMcpError('UNAUTHORIZED', 'Token de autenticación inválido o malformado', 401);
  }
}

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

import { getTool, listTools, registerTool } from './tools/index';

// --- Client-Side Tools (Ramses) ---
import {
  listMyRidesSchema,
  createRideSchema,
  getRideDetailsSchema,
  viewOffersSchema,
  acceptOfferSchema,
} from './schemas';
import { handleListMyRides } from './tools/list-my-rides';
import { handleCreateRide } from './tools/create-ride';
import { handleGetRideDetails } from './tools/get-ride-details';
import { handleViewOffers } from './tools/view-offers';
import { handleAcceptOffer } from './tools/accept-offer';

// Registrar tools del lado Cliente
registerTool({
  name: 'list_my_rides',
  description: 'Listar mis acarreos como cliente. Filtra por estado, página y límite.',
  schema: listMyRidesSchema,
  handler: (input, authToken, client, userId) => {
    if (!authToken || !client || !userId) {
      return Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify({ error: 'Se requiere authToken (JWT de Clerk)' }) }],
        isError: true,
      });
    }
    return handleListMyRides(input, authToken, client, userId);
  },
});

registerTool({
  name: 'create_ride',
  description: 'Crear un nuevo pedido de acarreo. Requiere título, descripción, tipo, ubicaciones y precio estimado.',
  schema: createRideSchema,
  handler: (input, authToken, client, userId) => {
    if (!authToken || !client || !userId) {
      return Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify({ error: 'Se requiere authToken (JWT de Clerk)' }) }],
        isError: true,
      });
    }
    return handleCreateRide(input, authToken, client, userId);
  },
});

registerTool({
  name: 'get_ride_details',
  description: 'Obtener detalles completos de un acarreo por su ID.',
  schema: getRideDetailsSchema,
  handler: (input, authToken, client, userId) => {
    if (!authToken || !client || !userId) {
      return Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify({ error: 'Se requiere authToken (JWT de Clerk)' }) }],
        isError: true,
      });
    }
    return handleGetRideDetails(input, authToken, client, userId);
  },
});

registerTool({
  name: 'view_offers',
  description: 'Ver ofertas recibidas para un acarreo. Nota: el endpoint backend no está implementado aún.',
  schema: viewOffersSchema,
  handler: (input, authToken, client, userId) => {
    if (!authToken || !client || !userId) {
      return Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify({ error: 'Se requiere authToken (JWT de Clerk)' }) }],
        isError: true,
      });
    }
    return handleViewOffers(input, authToken, client, userId);
  },
});

registerTool({
  name: 'accept_offer',
  description: 'Aceptar la oferta de un conductor para un acarreo. Opcionalmente acordar precio final.',
  schema: acceptOfferSchema,
  handler: (input, authToken, client, userId) => {
    if (!authToken || !client || !userId) {
      return Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify({ error: 'Se requiere authToken (JWT de Clerk)' }) }],
        isError: true,
      });
    }
    return handleAcceptOffer(input, authToken, client, userId);
  },
});

// === Handler: List Tools ===
server.setRequestHandler(ListToolsRequestSchema, async () => {
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

// === Handler: Call Tool ===
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const rawArgs = (args ?? {}) as Record<string, unknown>;

  try {
    const tool = getTool(name);
    if (!tool) {
      throw new SdkMcpError(ErrorCode.MethodNotFound, `Tool desconocida: ${name}`);
    }

    // Extraer authToken de los args raw (JWT de Clerk que pasa el usuario)
    const rawAuthToken = typeof rawArgs.authToken === 'string' ? rawArgs.authToken : undefined;

    // Eliminar authToken de los args antes de validar con Zod
    const { authToken: _, ...cleanArgs } = rawArgs;
    const parsed = tool.schema.parse(cleanArgs);

    // Decodificar JWT para obtener userId si hay authToken
    let userId: string | undefined;
    if (rawAuthToken) {
      userId = getUserIdFromToken(rawAuthToken);
    }

    const result = await tool.handler(parsed, rawAuthToken, apiClient, userId);

    // Pasar isError si el handler lo indicó (ej: view_offers devuelve error soft)
    if (result && typeof result === 'object' && 'isError' in result && result.isError) {
      return { content: result.content, isError: true };
    }

    return {
      content: result.content,
    };
  } catch (error) {
    // Nuestro CustomMcpError (de ./errors)
    if (error instanceof CustomMcpError) {
      return {
        content: [{ type: 'text', text: JSON.stringify(error) }],
        isError: true,
      };
    }
    // McpError del SDK
    if (error instanceof SdkMcpError) {
      return {
        content: [{ type: 'text', text: JSON.stringify(error) }],
        isError: true,
      };
    }
    // Zod validation errors
    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Datos de entrada inválidos',
              details: error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
              })),
            }),
          },
        ],
        isError: true,
      };
    }
    // Errores inesperados — relanzar para que el SDK los maneje
    throw error;
  }
});

// === Inicialización del servidor ===
async function main() {
  const transport = new StdioServerTransport();

  console.error(`🚚 MCP Server — Plataforma de Acarreos v0.1.0`);
  console.error(`   Backend: ${BACKEND_URL}`);
  console.error(`   Entorno: ${NODE_ENV}`);
  console.error(`   Tools registradas: ${listTools().length}`);

  await server.connect(transport);

  console.error(`✅ Servidor MCP listo. Esperando conexiones...`);
}

main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
