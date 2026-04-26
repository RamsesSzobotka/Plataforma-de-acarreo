import { mongoose } from '../db/mongo'

const userSchema = new mongoose.Schema({
  // ID de Clerk
  clerkId: { type: String, required: true, unique: true },
  
  // Datos del usuario (sincronizados desde Clerk)
  email: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  imageUrl: { type: String },
  
  // Rol en la plataforma
  role: {
    type: String,
    enum: ['client', 'driver', 'admin'],
    default: 'client'
  },
  
  // Estado
  isActive: { type: Boolean, default: true },
  
  // Para clientes
  phone: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
})

userSchema.index({ clerkId: 1 })
userSchema.index({ role: 1 })

export const User = mongoose.models.User || mongoose.model('User', userSchema)