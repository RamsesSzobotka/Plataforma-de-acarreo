import { Hono } from 'hono/tiny'
import { uploadImage } from '../utils/upload'
import { authMiddleware } from '../middleware'

const upload = new Hono()

// Subir imagen (protegido)
upload.post('/', authMiddleware, async (c) => {
  const user = c.get('user')
  console.log('🔵 [UPLOAD] Iniciando upload para usuario:', user?.clerkId)
  
  // Verificar que hay un archivo
  const contentType = c.req.header('content-type') || ''
  console.log('🔵 [UPLOAD] Content-Type:', contentType)
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'Content-Type debe ser multipart/form-data' }, 400)
  }
  
  // Obtener datos del formulario
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const folder = (formData.get('folder') as string) || 'general'
  
  console.log('🔵 [UPLOAD] File:', file?.name, 'Folder:', folder)
  
  if (!file) {
    return c.json({ error: 'No se proporcionó ningún archivo' }, 400)
  }
  
  // Convertir File a Buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  console.log('🔵 [UPLOAD] Buffer size:', buffer.length, 'bytes')
  
  try {
    console.log('🔵 [UPLOAD] Iniciando uploadImage a Cloudinary...')
    const result = await uploadImage(buffer, folder)
    console.log('✅ [UPLOAD] Upload exitoso:', result.url)
    return c.json({
      success: true,
      url: result.url,
      publicId: result.publicId,
    })
  } catch (error: any) {
    console.error('❌ [UPLOAD] Error:', {
      message: error.message,
      toString: error.toString(),
      stack: error.stack,
      fullError: error
    })
    return c.json({ 
      error: error.message || 'Error al subir imagen',
      details: error.toString()
    }, 500)
  }
})

export default upload