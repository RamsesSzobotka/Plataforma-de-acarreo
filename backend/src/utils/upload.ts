import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'stream'

// Configure Cloudinary
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
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `plataforma-acarreo/${folder}`,
        resource_type: 'image' as const,
        insecure: true,
      },
      (error, result) => {
        if (error) {
          reject(new Error(error.message))
          return
        }
        if (!result) {
          reject(new Error('No result from Cloudinary'))
          return
        }
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

