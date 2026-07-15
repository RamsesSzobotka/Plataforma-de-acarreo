import { mongoose } from '../db/mongo'

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['report_response', 'ride_message', 'offer_accepted', 'offer_received', 'ride_status', 'account_suspended', 'account_unsuspended', 'nearby_rides'],
    required: true
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  read: { type: Boolean, default: false },
  link: { type: String, default: null },
  metadata: {
    rideId: { type: String, default: null },
    reportId: { type: String, default: null },
    offerId: { type: String, default: null },
  },
}, { timestamps: true })

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, createdAt: -1 })

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema)
