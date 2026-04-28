import { mongoose } from '../db/mongo'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  // ID de Clerk
  clerkId: { type: String, unique: true },
  
  // Datos del usuario
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
  
  // Contraseña hasheada (para login directo de admin)
  password: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
})

// Método para verificar contraseña
userSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password)
}

// Método estático para crear usuario admin
userSchema.statics.createAdmin = async function(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10)
  return this.findOneAndUpdate(
    { email },
    {
      email,
      role: 'admin',
      password: hashedPassword,
      isActive: true,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  )
}

userSchema.index({ clerkId: 1 })
userSchema.index({ role: 1 })

export const User = mongoose.models.User || mongoose.model('User', userSchema)