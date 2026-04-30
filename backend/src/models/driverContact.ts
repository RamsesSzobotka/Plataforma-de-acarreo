import { mongoose } from '../db/mongo'

const driverContactSchema = new mongoose.Schema({
  driverId: { type: String, required: true },
  clientId: { type: String, required: true },
  rideId: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  // info del driver en el momento del contacto
  driverFirstName: String,
  driverLastName: String,
  driverImageUrl: String,
  // Propuesta de precio
  proposedPrice: { type: Number },
  priceProposedAt: { type: Date },
  proposalCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
})

// Índice para buscar contacts por ride
driverContactSchema.index({ rideId: 1, isActive: 1 })
// Índice para buscar contacts por driver
driverContactSchema.index({ driverId: 1, rideId: 1 })

export const DriverContact = mongoose.models.DriverContact || mongoose.model('DriverContact', driverContactSchema)