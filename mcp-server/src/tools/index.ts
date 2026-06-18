/**
 * Registry centralizado de tools del MCP Server.
 * 
 * Cada tool se registra aquí vía `registerTool()`.
 * Los handlers los implementará cada persona asignada.
 */

import { z } from 'zod';

export type ToolHandler = (input: any) => Promise<{ content: { type: 'text'; text: string }[] }>;

export interface ToolRegistration {
  name: string;
  description: string;
  schema: z.ZodSchema;
  handler: ToolHandler;
}

const toolRegistry = new Map<string, ToolRegistration>();

export function registerTool(reg: ToolRegistration): void {
  toolRegistry.set(reg.name, reg);
}

export function getTool(name: string): ToolRegistration | undefined {
  return toolRegistry.get(name);
}

export function listTools(): { name: string; description: string }[] {
  return Array.from(toolRegistry.values()).map(({ name, description }) => ({ name, description }));
}
