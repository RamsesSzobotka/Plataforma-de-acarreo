import mongoose from 'mongoose'

const consentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  version: { type: String, required: true },
  acceptedAt: { type: Date, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String },
})

consentSchema.index({ userId: 1, acceptedAt: -1 }, { name: 'consent_user_timestamp' })

export const Consent = mongoose.models.Consent || mongoose.model('Consent', consentSchema)
