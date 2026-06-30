import { mongoose } from '../db/mongo'

const messageSchema = new mongoose.Schema({
  rideId: { type: String, required: true },
  senderId: { type: String, required: true },
  content: { type: String, required: true },
  read: { type: Boolean, default: false }
}, {
  timestamps: true
})

messageSchema.index({ rideId: 1, createdAt: 1 })

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema)