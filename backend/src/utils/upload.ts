import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'stream'

// Configure Cloudinary
console.log('📢 [CLOUDINARY CONFIG] Intentando configurar con:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING',
})

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export interface UploadResult {
  url: string
  publicId: string
}

/**
 * Sube una imagen a Cloudinary
 * @param file - Buffer de la imagen
 * @param folder - Subcarpeta en Cloudinary (ej: 'drivers', 'rides')
 * @returns URL pública y publicId
 */
export async function uploadImage(file: Buffer, folder: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    console.log('📤 [CLOUDINARY] Configuración:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY ? '***' : 'FALTA',
      api_secret: process.env.CLOUDINARY_API_SECRET ? '***' : 'FALTA',
    })
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `plataforma-acarreo/${folder}`,
        resource_type: 'image' as const,
        insecure: true,
      },
      (error, result) => {
        if (error) {
          console.error('❌ [CLOUDINARY] Error en upload:', error)
          reject(new Error(error.message))
          return
        }
        if (!result) {
          console.error('❌ [CLOUDINARY] Sin resultado')
          reject(new Error('No result from Cloudinary'))
          return
        }
        console.log('✅ [CLOUDINARY] Upload exitoso:', result.public_id)
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        })
      }
    )

    const stream = Readable.from(file)
    stream.pipe(uploadStream)
  })
}

/**
 * Sube múltiples imágenes a Cloudinary
 * @param files - Array de buffers
 * @param folder - Subcarpeta
 * @returns Array de resultados
 */
export async function uploadImages(files: Buffer[], folder: string): Promise<UploadResult[]> {
  const uploads = files.map((file) => uploadImage(file, folder))
  return Promise.all(uploads)
}

/**
 * Elimina una imagen de Cloudinary
 * @param publicId - Public ID de la imagen
 */
export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

/**
 * Elimina múltiples imágenes de Cloudinary
 * @param publicIds - Array de publicIds
 */
export async function deleteImages(publicIds: string[]): Promise<void> {
  await Promise.all(publicIds.map((id) => deleteImage(id)))
}

export { cloudinary }