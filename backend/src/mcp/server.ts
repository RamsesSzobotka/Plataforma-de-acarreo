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
import { getTool, listTools, registerAllTools } from './tools/index';
import { writeAuditEvent, AuditAction } from './audit';

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
    const start = Date.now();

    // Map tool name to audit action
    const toolToAuditAction: Record<string, AuditAction> = {
      'create_ride': 'mcp.tool.create_ride',
      'accept_offer': 'mcp.tool.accept_offer',
      'propose_price': 'mcp.tool.propose_price',
      'cancel_ride': 'mcp.tool.cancel_ride',
      'start_trip': 'mcp.tool.start_trip',
      'upload_delivery_photo': 'mcp.tool.upload_delivery_photo',
      'confirm_delivery': 'mcp.tool.confirm_delivery',
      'rate_service': 'mcp.tool.rate_service',
      'send_message': 'mcp.tool.send_message',
    };

    try {
      const tool = getTool(name);
      if (!tool) throw new SdkMcpError(ErrorCode.MethodNotFound, `Tool desconocida: ${name}`);
      const parsed = tool.schema.parse(rawArgs);
      // clerkId comes from the closure — injected when createMcpServer(clerkId) was called
      const result = await tool.handler(parsed, undefined, undefined, clerkId);
      if (result && typeof result === 'object' && 'isError' in result && result.isError) {
        return { content: result.content, isError: true };
      }

      // Audit success
      const auditAction = toolToAuditAction[name];
      if (auditAction) {
        const resourceId = rawArgs.rideId as string || rawArgs.offerId as string || undefined;
        writeAuditEvent({
          clerkId,
          action: auditAction,
          toolName: name,
          resourceType: 'ride',
          resourceId,
          success: true,
          durationMs: Date.now() - start,
        }).catch(() => {});
      }

      return { content: result.content };
    } catch (error) {
      const auditAction = toolToAuditAction[name];
      if (auditAction) {
        const resourceId = rawArgs.rideId as string || rawArgs.offerId as string || undefined;
        writeAuditEvent({
          clerkId,
          action: auditAction,
          toolName: name,
          resourceType: 'ride',
          resourceId,
          success: false,
          errorCode: error instanceof CustomMcpError ? error.code : 'INTERNAL_ERROR',
          errorMessage: (error as Error).message,
          durationMs: Date.now() - start,
        }).catch(() => {});
      }

      if (error instanceof CustomMcpError) return { content: [{ type: 'text', text: JSON.stringify(error) }], isError: true };
      if (error instanceof SdkMcpError) return { content: [{ type: 'text', text: JSON.stringify(error) }], isError: true };
      if (error instanceof z.ZodError) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Datos inválidos', details: error.errors.map(e => ({ path: e.path.join('.'), message: e.message })) }) }], isError: true };
      throw error;
    }
  });

  return mcpServer;
}

/**
 * Validate an MCP token using O(1) lookup.
 *
 * Token format: mcp_<tokenId>_<secret>
 * - tokenId: 16-char hex identifier for DB lookup
 * - secret: random bytes that are hashed in the DB
 * - full token: mcp_<tokenId>_<secret> (stored as hash)
 *
 * Flow:
 * 1. Parse tokenId from the token string
 * 2. O(1) lookup by tokenId in DB
 * 3. Compare full token against stored hash
 * 4. Update lastUsedAt (fire-and-forget)
 */
export async function validateMcpToken(token: string): Promise<string | null> {
  try {
    // Token must start with 'mcp_' prefix
    if (!token.startsWith('mcp_')) {
      return null;
    }

    // Token format: mcp_<tokenId>_<secret>
    // tokenId es siempre hex (sin _), pero secret es base64url (PUEDE contener _)
    // Por eso NO podemos usar split('_') directo — extraemos solo el primer segmento
    const withoutPrefix = token.slice(4); // Remove 'mcp_'
    const firstUnderscore = withoutPrefix.indexOf('_');
    if (firstUnderscore <= 0) {
      return null;
    }
    const tokenId = withoutPrefix.slice(0, firstUnderscore);
    const secret = withoutPrefix.slice(firstUnderscore + 1);
    if (!tokenId || !secret) {
      return null;
    }

    // O(1) lookup by tokenId - much faster than iterating all tokens
    const { db } = await import('../db/mongo');
    const { compare } = await import('bcryptjs');

    const tokenDoc = await db.collection('mcp_tokens').findOne({
      tokenId,
      revokedAt: null
    });

    if (!tokenDoc) {
      return null;
    }

    // Compare the full token against the stored hash
    // The full token includes the secret part that was never stored
    const fullToken = `mcp_${tokenId}_${secret}`;
    const match = await compare(fullToken, tokenDoc.tokenHash);

    if (!match) {
      return null;
    }

    // Update lastUsedAt asynchronously (fire-and-forget)
    db.collection('mcp_tokens').updateOne(
      { tokenId },
      { $set: { lastUsedAt: new Date() } }
    ).catch(() => {
      // Ignore errors - this is non-critical
    });

    return tokenDoc.clerkId;
  } catch {
    return null;
  }
}
