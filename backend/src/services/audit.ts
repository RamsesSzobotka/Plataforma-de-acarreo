import { AuditLog } from '../models/auditLog'

export interface LogAuditParams {
  action: string
  entityType: string
  entityId: string
  userId: string | null
  userRole?: string
  details?: Record<string, any>
  ip?: string
  userAgent?: string
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await AuditLog.create({
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      userRole: params.userRole || null,
      details: params.details || {},
      metadata: {
        ip: params.ip || '',
        userAgent: params.userAgent || '',
        timestamp: new Date(),
      },
    })
  } catch (error) {
    // Never throw — audit should never break business logic
    console.error('❌ Error al registrar auditoría:', error)
  }
}
