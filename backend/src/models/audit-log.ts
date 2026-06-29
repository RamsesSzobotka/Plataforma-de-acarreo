import { mongoose } from '../db/mongo'

const auditLogSchema = new mongoose.Schema({
  // Who
  clerkId: { type: String, required: true, index: true },
  role: { type: String },

  // What
  action: { type: String, required: true, index: true },
  toolName: { type: String },
  resourceType: { type: String }, // e.g., 'ride', 'offer', 'token'
  resourceId: { type: String }, // e.g., rideId, offerId

  // Result
  success: { type: Boolean, required: true },
  errorCode: { type: String },
  errorMessage: { type: String },

  // Context
  ipAddress: { type: String },
  userAgent: { type: String },

  // Performance
  durationMs: { type: Number },

  // Timestamp
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: false // we manage createdAt manually
})

auditLogSchema.index({ clerkId: 1, createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 })
auditLogSchema.index({ resourceType: 1, resourceId: 1 })

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)