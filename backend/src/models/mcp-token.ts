import { db } from '../db/mongo';

export interface McpToken {
  clerkId: string;
  tokenId: string;        // Unique public identifier for O(1) lookup
  tokenHash: string;      // Hash of the full token (mcp_<tokenId>_<secret>)
  lastUsedAt?: Date;
  createdAt: Date;
  revokedAt?: Date;       // For revocation support
}

export const MCP_TOKENS_COLLECTION = 'mcp_tokens';

export async function createMcpTokenIndexes() {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  const indexes = await collection.indexes();
  
  // Index on tokenId for O(1) lookup during validation
  const tokenIdExists = indexes.some(idx => idx.name === 'tokenId_1');
  if (!tokenIdExists) {
    await collection.createIndex({ tokenId: 1 }, { unique: true, name: 'tokenId_1' });
  }
  
  // Index on clerkId for user lookups
  const clerkIdExists = indexes.some(idx => idx.name === 'clerkId_1');
  if (!clerkIdExists) {
    await collection.createIndex({ clerkId: 1 }, { name: 'clerkId_1' });
  }
}

export async function saveMcpToken(clerkId: string, tokenId: string, tokenHash: string): Promise<McpToken> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  const result = await collection.findOneAndUpdate(
    { clerkId },
    {
      $set: { tokenId, tokenHash, createdAt: new Date(), revokedAt: null },
      $unset: { lastUsedAt: '' }
    },
    { upsert: true, returnDocument: 'after' }
  );
  if (!result) {
    throw new Error('Failed to save MCP token');
  }
  return result;
}

export async function getMcpTokenByClerkId(clerkId: string): Promise<McpToken | null> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  return collection.findOne({ clerkId, revokedAt: null });
}

export async function getMcpTokenByTokenId(tokenId: string): Promise<McpToken | null> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  return collection.findOne({ tokenId, revokedAt: null });
}

export async function updateTokenLastUsed(tokenId: string): Promise<void> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  await collection.updateOne({ tokenId }, { $set: { lastUsedAt: new Date() } });
}

export async function deleteMcpToken(clerkId: string): Promise<void> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  await collection.deleteOne({ clerkId });
}

export async function revokeMcpToken(tokenId: string): Promise<void> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  await collection.updateOne({ tokenId }, { $set: { revokedAt: new Date() } });
}
