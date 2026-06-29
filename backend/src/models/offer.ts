import { mongoose } from '../db/mongo'

const offerSchema = new mongoose.Schema({
  rideId: { type: String, required: true },
  clientId: { type: String, required: true },
  driverId: { type: String, required: true },
  
  // Price proposed by the driver
  amount: { type: Number, required: true },
  
  // Optional message from driver to client
  message: { type: String },
  
  // Offer status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending'
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
})

// Indexes
offerSchema.index({ rideId: 1, status: 1 })
offerSchema.index({ driverId: 1, rideId: 1 })
offerSchema.index({ clientId: 1 })
offerSchema.index({ rideId: 1, driverId: 1 }, { unique: true }) // One active offer per driver per ride

export const Offer = mongoose.models.Offer || mongoose.model('Offer', offerSchema)
