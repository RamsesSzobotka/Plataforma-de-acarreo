import mongoose from 'mongoose';

const MONGO_URL = 'mongodb://jfbarrios16_db_user:LDfAD8JoXRdAeVF6@localhost:27017/pollclass?authSource=admin';

async function cleanup() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log('✅ Conectado a MongoDB');
    
    const db = mongoose.connection.db;
    
    // Eliminar la colección drivers completamente
    console.log('🔄 Eliminando colección drivers...');
    await db.collection('drivers').drop().catch(() => console.log('ℹ️ Colección no existía'));
    
    console.log('✅ ¡Limpieza completada! Colección drivers eliminada.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

cleanup();
