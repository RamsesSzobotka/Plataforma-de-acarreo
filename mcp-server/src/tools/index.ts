/**
 * Registry centralizado de tools del MCP Server.
 * 
 * Cada tool se registra aquí vía `registerTool()`.
 * Los handlers los implementará cada persona asignada.
 */

import { z } from 'zod';
import type { ApiClient } from '../api-client';

export type ToolHandler = (
  input: any,
  authToken?: string,
  apiClient?: ApiClient,
  userId?: string,
) => Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }>;

export interface ToolRegistration {
  name: string;
  description: string;
  schema: z.ZodSchema;
  handler: ToolHandler;
}

export interface ToolInfo {
  name: string;
  description: string;
  schema: z.ZodSchema;
}

const toolRegistry = new Map<string, ToolRegistration>();

export function registerTool(reg: ToolRegistration): void {
  toolRegistry.set(reg.name, reg);
}

export function getTool(name: string): ToolRegistration | undefined {
  return toolRegistry.get(name);
}

export function listTools(): ToolInfo[] {
  return Array.from(toolRegistry.values()).map(({ name, description, schema }) => ({ name, description, schema }));
}
