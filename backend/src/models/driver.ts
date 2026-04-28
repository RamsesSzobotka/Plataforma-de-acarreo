import { mongoose } from '../db/mongo'

const driverSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  
  // === INFO BÁSICA ===
  vehicleType: { type: String, required: true },
  plate: { type: String, required: true },
  capacityKg: { type: Number, required: true },
  
  // === DOCUMENTOS OBLIGATORIOS ===
  vehicleImages: [{ type: String }],      // Fotos del vehículo (mín. 1)
  licenseType: { type: String, required: true },          // Tipo de licencia
  licenseImage: { type: String, required: true },        // Foto de licencia
  cedulaFront: { type: String, required: true },          // Cédula - frente
  cedulaBack: { type: String, required: true },          // Cédula - reverso
  ruvDocument: { type: String, required: true },         // RUV del vehículo
  plateImage: { type: String, required: true },          // Foto de placa vigente
  insurancePolicy: { type: String, required: true },    // Póliza de seguro terceros
  
  // === DOCUMENTOS OPCIONALES ===
  carneBlanco: { type: String },         // Carné blanco
  carneVerde: { type: String },         // Carné verde
  carneTransporteCarga: { type: String }, // Carné transporte
  fumigationCertificate: { type: String }, // Fumigación
  
  // === DATOS DE CONTACTO ===
  phone: { type: String, required: true },
  
  // === VERIFICACIÓN ===
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'in_review', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  rejectionReason: { type: String },     // Por qué fue rechazado
  reviewedBy: { type: String },         // clerkId del admin
  reviewedAt: { type: Date },
  
  // === DISPONIBILIDAD ===
  isAvailable: { type: Boolean, default: false },
  
  // === UBICACIÓN ACTUAL (SIMPLE - se actualiza cuando está en línea) ===
  currentLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  
  // === CALIFICACIÓN ===
  rating: { type: Number, default: 0 },
  totalRides: { type: Number, default: 0 },
  
  // === LEGACY ===
  isVerified: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
})

// === ÍNDICES ===
driverSchema.index({ userId: 1 }, { unique: true })
driverSchema.index({ isAvailable: 1 })
driverSchema.index({ verificationStatus: 1 })
// Índice geoespacial se puede agregar después cuando sea necesario

export const Driver = mongoose.models.Driver || mongoose.model('Driver', driverSchema)
