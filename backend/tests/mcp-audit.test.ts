import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { db } from '../src/db/mongo';
import { writeAuditEvent, AuditAction } from '../src/mcp/audit';
import { setupTests, teardownTests, cleanupCollection } from './setup';

describe('MCP Audit', () => {
  beforeAll(async () => {
    await setupTests();
  });

  afterAll(async () => {
    await teardownTests();
  });

  beforeEach(async () => {
    await cleanupCollection('mcpAuditLogs');
  });

  describe('Audit Log Entry Creation', () => {
    it('should create audit log entry on successful tool execution', async () => {
      const clerkId = 'audit_success_user';
      const action: AuditAction = 'mcp.tool.create_ride';
      const toolName = 'create_ride';
      const resourceId = 'ride_123';

      await writeAuditEvent({
        clerkId,
        role: 'client',
        action,
        toolName,
        resourceType: 'ride',
        resourceId,
        success: true,
        durationMs: 150,
      });

      // Give fire-and-forget time to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const logs = await db.collection('mcpAuditLogs').find({ clerkId }).toArray();
      expect(logs.length).toBeGreaterThan(0);

      const log = logs[0];
      expect(log.clerkId).toBe(clerkId);
      expect(log.action).toBe(action);
      expect(log.toolName).toBe(toolName);
      expect(log.success).toBe(true);
      expect(log.errorCode).toBeUndefined();
    });

    it('should create audit log entry on failed tool execution', async () => {
      const clerkId = 'audit_fail_user';
      const action: AuditAction = 'mcp.tool.accept_offer';
      const toolName = 'accept_offer';
      const resourceId = 'offer_456';

      await writeAuditEvent({
        clerkId,
        role: 'client',
        action,
        toolName,
        resourceType: 'offer',
        resourceId,
        success: false,
        errorCode: 'CONFLICT',
        errorMessage: 'Offer already accepted',
        durationMs: 50,
      });

      // Give fire-and-forget time to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const logs = await db.collection('mcpAuditLogs').find({ clerkId }).toArray();
      expect(logs.length).toBeGreaterThan(0);

      const log = logs[0];
      expect(log.clerkId).toBe(clerkId);
      expect(log.action).toBe(action);
      expect(log.success).toBe(false);
      expect(log.errorCode).toBe('CONFLICT');
      expect(log.errorMessage).toBe('Offer already accepted');
    });

    it('should have correct clerkId and toolName in audit log', async () => {
      const clerkId = 'audit_verify_user';
      const action: AuditAction = 'mcp.tool.rate_service';
      const toolName = 'rate_service';

      await writeAuditEvent({
        clerkId,
        role: 'driver',
        action,
        toolName,
        resourceType: 'rating',
        resourceId: 'rating_789',
        success: true,
        durationMs: 100,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const log = await db.collection('mcpAuditLogs').findOne({ clerkId });
      expect(log).not.toBeNull();
      expect(log?.clerkId).toBe(clerkId);
      expect(log?.toolName).toBe(toolName);
      expect(log?.role).toBe('driver');
    });

    it('failed tool should have errorCode set', async () => {
      const clerkId = 'audit_error_code';

      await writeAuditEvent({
        clerkId,
        action: 'mcp.tool.start_trip',
        toolName: 'start_trip',
        success: false,
        errorCode: 'FORBIDDEN',
        errorMessage: 'Only assigned driver can start trip',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const log = await db.collection('mcpAuditLogs').findOne({ clerkId });
      expect(log).not.toBeNull();
      expect(log?.success).toBe(false);
      expect(log?.errorCode).toBe('FORBIDDEN');
    });
  });
});
