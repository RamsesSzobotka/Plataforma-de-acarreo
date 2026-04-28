import { connectDB } from '../db/mongo'
import { User } from '../models/user'

const ADMIN_EMAIL = 'admin@gmail.com'
const ADMIN_PASSWORD = 'Hola123!'

async function createAdmin() {
  try {
    await connectDB()
    console.log('✅ Conectado a MongoDB')
    
    // Crear usuario admin
    const admin = await User.createAdmin(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    console.log('✅ Usuario admin creado/actualizado:')
    console.log(`   Email: ${ADMIN_EMAIL}`)
    console.log(`   Password: ${ADMIN_PASSWORD}`)
    console.log(`   Role: ${admin.role}`)
    console.log(`   ID: ${admin._id}`)
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

createAdmin()