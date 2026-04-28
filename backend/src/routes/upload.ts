import { Hono } from 'hono/tiny'
import { uploadImage } from '../utils/upload'
import { authMiddleware } from '../middleware'

const upload = new Hono()

// Subir imagen (protegido)
upload.post('/', authMiddleware, async (c) => {
  const user = c.get('user')
  
  // Verificar que hay un archivo
  const contentType = c.req.header('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'Content-Type debe ser multipart/form-data' }, 400)
  }
  
  //获取表单数据
  const formData = await c.req.parseForm()
  const file = formData.get('file') as File | null
  const folder = (formData.get('folder') as string) || 'general'
  
  if (!file) {
    return c.json({ error: 'No se proporcionó ningún archivo' }, 400)
  }
  
  // Convertir File a Buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  try {
    const result = await uploadImage(buffer, folder)
    return c.json({
      success: true,
      url: result.url,
      publicId: result.publicId,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return c.json({ error: 'Error al subir imagen' }, 500)
  }
})

export default upload