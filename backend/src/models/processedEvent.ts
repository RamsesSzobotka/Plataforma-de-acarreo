import { mongoose } from '../db/mongo'

const processedEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
  payload: { type: Object },
}, {
  timestamps: true,
})

export const ProcessedEvent = mongoose.models.ProcessedEvent || mongoose.model('ProcessedEvent', processedEventSchema)