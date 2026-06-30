import { db } from '../db/mongo';

export type AuditAction =
  // Token actions
  | 'mcp.token.created'
  | 'mcp.token.revoked'
  // Tool actions
  | 'mcp.tool.create_ride'
  | 'mcp.tool.accept_offer'
  | 'mcp.tool.propose_price'
  | 'mcp.tool.cancel_ride'
  | 'mcp.tool.start_trip'
  | 'mcp.tool.upload_delivery_photo'
  | 'mcp.tool.confirm_delivery'
  | 'mcp.tool.rate_service'
  | 'mcp.tool.send_message';

export interface AuditEvent {
  clerkId: string;
  role?: string;
  action: AuditAction;
  toolName?: string;
  resourceType?: string;
  resourceId?: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
}

export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  // Fire and forget — don't await
  db.collection('audit_logs').insertOne({
    ...event,
    createdAt: new Date(),
  }).catch((err) => {
    console.error('[AUDIT] Failed to write audit event:', err);
  });
}