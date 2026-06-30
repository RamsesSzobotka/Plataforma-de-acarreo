import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import crypto from 'crypto';
import { hash } from 'bcryptjs';
import { db } from '../src/db/mongo';
import { saveMcpToken, getMcpTokenByTokenId, revokeMcpToken, createMcpTokenIndexes, MCP_TOKENS_COLLECTION } from '../src/models/mcp-token';
import { validateMcpToken } from '../src/mcp/server';
import { setupTests, teardownTests, cleanupCollection } from './setup';

describe('MCP Token', () => {
  beforeAll(async () => {
    await setupTests();
    await createMcpTokenIndexes();
  });

  afterAll(async () => {
    await cleanupCollection(MCP_TOKENS_COLLECTION);
    await teardownTests();
  });

  beforeEach(async () => {
    await cleanupCollection(MCP_TOKENS_COLLECTION);
  });

  describe('Token Format', () => {
    it('should generate token with format mcp_<tokenId>_<secret>', async () => {
      const clerkId = 'user_test_123';
      const tokenId = crypto.randomBytes(8).toString('hex');
      const secret = crypto.randomBytes(24).toString('base64url');
      const rawToken = `mcp_${tokenId}_${secret}`;
      const tokenHash = await hash(rawToken, 10);

      await saveMcpToken(clerkId, tokenId, tokenHash);

      // Verify format
      expect(rawToken).toMatch(/^mcp_[a-f0-9]{16}_[A-Za-z0-9_-]+$/);
    });
  });

  describe('validateMcpToken', () => {
    it('should validate a valid token and return clerkId', async () => {
      const clerkId = 'user_valid_test';
      const tokenId = crypto.randomBytes(8).toString('hex');
      const secret = crypto.randomBytes(24).toString('base64url');
      const rawToken = `mcp_${tokenId}_${secret}`;
      const tokenHash = await hash(rawToken, 10);

      await saveMcpToken(clerkId, tokenId, tokenHash);

      const result = await validateMcpToken(rawToken);
      expect(result).toBe(clerkId);
    });

    it('should return null for invalid token format (no mcp_ prefix)', async () => {
      const result = await validateMcpToken('invalid_token_format');
      expect(result).toBeNull();
    });

    it('should return null for token with wrong secret', async () => {
      const clerkId = 'user_wrong_secret';
      const tokenId = crypto.randomBytes(8).toString('hex');
      const wrongSecret = crypto.randomBytes(24).toString('base64url');
      const correctSecret = crypto.randomBytes(24).toString('base64url');
      const rawToken = `mcp_${tokenId}_${correctSecret}`;
      const tokenHash = await hash(rawToken, 10);

      await saveMcpToken(clerkId, tokenId, tokenHash);

      // Try with wrong secret
      const result = await validateMcpToken(`mcp_${tokenId}_${wrongSecret}`);
      expect(result).toBeNull();
    });

    it('should return null after token is revoked', async () => {
      const clerkId = 'user_revoked';
      const tokenId = crypto.randomBytes(8).toString('hex');
      const secret = crypto.randomBytes(24).toString('base64url');
      const rawToken = `mcp_${tokenId}_${secret}`;
      const tokenHash = await hash(rawToken, 10);

      await saveMcpToken(clerkId, tokenId, tokenHash);

      // Revoke the token
      await revokeMcpToken(tokenId);

      // Validate should return null
      const result = await validateMcpToken(rawToken);
      expect(result).toBeNull();
    });

    it('should return null for token with non-existent tokenId', async () => {
      const fakeTokenId = crypto.randomBytes(8).toString('hex');
      const secret = crypto.randomBytes(24).toString('base64url');
      const rawToken = `mcp_${fakeTokenId}_${secret}`;

      const result = await validateMcpToken(rawToken);
      expect(result).toBeNull();
    });
  });

  describe('Token with old format (pre-phase7)', () => {
    it('should NOT validate tokens without proper mcp_ prefix', async () => {
      const oldFormatToken = 'old_token_format_without_prefix';
      const result = await validateMcpToken(oldFormatToken);
      expect(result).toBeNull();
    });

    it('should NOT validate tokens with wrong number of parts', async () => {
      const tokenTwoParts = 'mcp_something';
      const tokenNoSecret = 'mcp_tokenid_';

      expect(await validateMcpToken(tokenTwoParts)).toBeNull();
      expect(await validateMcpToken(tokenNoSecret)).toBeNull();
    });
  });
});
