import mongoose from 'mongoose'

export async function connectDB() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está configurada en .env')
  }

  await mongoose.connect(databaseUrl)

  // Event listeners
  mongoose.connection.on('connected', () => {
    console.log('🔌 MongoDB conectado')
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB desconectado')
  })

  mongoose.connection.on('error', (err) => {
    console.error('❌ Error en MongoDB:', err)
  })

  return mongoose.connection
}

export async function disconnectDB() {
  await mongoose.disconnect()
}

export { mongoose }

// DB instance for direct access
export const db = mongoose.connection