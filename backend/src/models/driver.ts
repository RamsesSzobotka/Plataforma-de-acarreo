import { mongoose } from '../db/mongo'

const driverSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  
  // Información del vehículo
  vehicleType: { type: String, required: true }, // sedan, pickup, truck
  plate: { type: String, required: true },
  capacityKg: { type: Number, required: true },
  
  // Disponibilidad
  isAvailable: { type: Boolean, default: true },
  
  // Ubicación actual (GeoJSON)
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] } // [lng, lat]
  },
  
  // Calificación promedio
  rating: { type: Number, default: 0 },
  totalRides: { type: Number, default: 0 },
  
  // Verificación
  isVerified: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
})

driverSchema.index({ currentLocation: '2dsphere' })
driverSchema.index({ isAvailable: 1 })

export const Driver = mongoose.models.Driver || mongoose.model('Driver', driverSchema)