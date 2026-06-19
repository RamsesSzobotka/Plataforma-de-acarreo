import { db } from '../db/mongo';

export interface McpToken {
  clerkId: string;
  tokenHash: string;
  lastUsedAt?: Date;
  createdAt: Date;
}

export const MCP_TOKENS_COLLECTION = 'mcp_tokens';

export async function createMcpTokenIndexes() {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  await collection.createIndex({ clerkId: 1 }, { unique: true });
}

export async function saveMcpToken(clerkId: string, tokenHash: string): Promise<void> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  await collection.updateOne(
    { clerkId },
    { $set: { tokenHash, createdAt: new Date() }, $unset: { lastUsedAt: '' } },
    { upsert: true }
  );
}

export async function getMcpToken(clerkId: string): Promise<McpToken | null> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  return collection.findOne({ clerkId });
}

export async function updateTokenLastUsed(clerkId: string): Promise<void> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  await collection.updateOne({ clerkId }, { $set: { lastUsedAt: new Date() } });
}

export async function deleteMcpToken(clerkId: string): Promise<void> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  await collection.deleteOne({ clerkId });
}
