import { mongoose } from '../db/mongo'

const driverSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  
  // === INFO BÁSICA ===
  vehicleType: { type: String, required: true },
  plate: { type: String, required: true },
  capacityKg: { type: Number, required: true },
  
  // Fotos del vehículo
  vehicleImages: [{ type: String }],
  
  // Licencia
  licenseType: { type: String },
  licenseImage: { type: String },
  
  // Cédula
  cedulaFront: { type: String },
  cedulaBack: { type: String },
  
  // Documentos del vehículo
  ruvDocument: { type: String },
  plateImage: { type: String },
  insurancePolicy: { type: String },
  
  // Documentos opcionales
  carneBlanco: { type: String },
  carneVerde: { type: String },
  carneTransporteCarga: { type: String },
  fumigationCertificate: { type: String },
  
  // Teléfono
  phone: { type: String },
  
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
  verificationStatus: {
    type: String,
    enum: ['pending', 'in_review', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  rejectionReason: { type: String },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  isVerified: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
})

driverSchema.index({ userId: 1 }, { unique: true })
driverSchema.index({ currentLocation: '2dsphere' })
driverSchema.index({ isAvailable: 1 })
driverSchema.index({ verificationStatus: 1 })

export const Driver = mongoose.models.Driver || mongoose.model('Driver', driverSchema)