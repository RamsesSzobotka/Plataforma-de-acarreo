// INMUTABLE — Los registros de auditoría no deben editarse ni eliminarse

import { mongoose } from '../db/mongo'

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },           // e.g. 'ride.status_change'
  entityType: { type: String, required: true },       // e.g. 'ride', 'user', 'driver'
  entityId: { type: String, required: true },          // ObjectId or Clerk ID
  userId: { type: String, default: null },             // clerkId of who did it
  userRole: { type: String, default: null },           // 'client', 'driver', 'admin'
  details: { type: Object, default: {} },               // before/after, reason, etc.
  metadata: {
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
}, {
  timestamps: true,
})

// Índices para consultas de auditoría
auditLogSchema.index({ userId: 1, action: 1 }, { name: 'audit_user_action' })
auditLogSchema.index({ entityType: 1, entityId: 1 }, { name: 'audit_entity' })
auditLogSchema.index({ action: 1 }, { name: 'audit_action' })
auditLogSchema.index({ 'metadata.timestamp': -1 }, { name: 'audit_timestamp' })

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)
