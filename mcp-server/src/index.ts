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

import { getTool, listTools } from './tools/index';

// Nota: Las tools se registran en src/tools/*.ts vía registerTool().
// Cada persona asignada implementará su handler y lo registrará allí.

// === Handler: List Tools ===
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = listTools();
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: { type: 'object' as const, properties: {} },
    })),
  };
});

// === Handler: Call Tool ===
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const tool = getTool(name);
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
