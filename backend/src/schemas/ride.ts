import { z } from 'zod'

// Enums
const RIDE_TYPES = ['mudanza', 'electrodomesticos', 'muebles', 'productos', 'otros'] as const
const RIDE_STATUSES = ['requested', 'negotiating', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled'] as const

// Esquemas reutilizables
const locationSchema = z.object({
  address: z.string()
    .trim()
    .min(5, 'La dirección debe tener al menos 5 caracteres')
    .max(255, 'La dirección no puede exceder 255 caracteres'),
  coordinates: z.array(z.number()).length(2)
    .optional()
    .default([0, 0])
})

// Schema para crear ride
export const createRideSchema = z.object({
  title: z.string()
    .trim()
    .min(10, 'El título debe tener al menos 10 caracteres')
    .max(100, 'El título no puede exceder 100 caracteres'),
  description: z.string()
    .trim()
    .min(20, 'La descripción debe tener al menos 20 caracteres')
    .max(2000, 'La descripción no puede exceder 2000 caracteres'),
  type: z.enum(RIDE_TYPES, {
    errorMap: () => ({ message: `El tipo debe ser uno de: ${RIDE_TYPES.join(', ')}` })
  }),
  pickupLocation: locationSchema,
  dropoffLocation: locationSchema,
  estimatedPrice: z.number()
    .positive('El precio debe ser mayor a 0')
    .multipleOf(0.01, 'El precio debe tener máximo 2 decimales'),
  packages: z.number()
    .positive()
    .optional(),
  weight: z.number()
    .positive()
    .optional(),
  notes: z.string()
    .trim()
    .max(500, 'Las notas no pueden exceder 500 caracteres')
    .optional(),
  preferredDate: z.date().optional(),
  images: z.array(z.object({
    url: z.string().url(),
    publicId: z.string().optional()
  }))
    .max(8, 'Máximo 8 imágenes permitidas')
    .default([])
})

// Schema para actualizar ride
export const updateRideSchema = z.object({
  title: z.string().trim().min(10).max(100).optional(),
  description: z.string().trim().min(20).max(2000).optional(),
  type: z.enum(RIDE_TYPES).optional(),
  pickupLocation: locationSchema.optional(),
  dropoffLocation: locationSchema.optional(),
  estimatedPrice: z.number().positive().multipleOf(0.01).optional(),
  packages: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  notes: z.string().trim().max(500).optional(),
  preferredDate: z.date().optional(),
  images: z.array(z.object({
    url: z.string().url(),
    publicId: z.string().optional()
  }))
    .max(8)
    .optional()
}).strict()

// Schema para aceptar ride (conductor)
export const acceptRideSchema = z.object({
  agreedPrice: z.number()
    .positive('El precio debe ser mayor a 0')
    .multipleOf(0.01, 'El precio debe tener máximo 2 decimales')
})

// Schema para cambiar estado
export const updateStatusSchema = z.object({
  status: z.enum(RIDE_STATUSES, {
    errorMap: () => ({ message: `El estado debe ser uno de: ${RIDE_STATUSES.join(', ')}` })
  }),
  reason: z.string().optional()
})

// Schema para cancelar
export const cancelRideSchema = z.object({
  cancellationReason: z.string()
    .trim()
    .min(5, 'La razón debe tener al menos 5 caracteres')
    .max(500, 'La razón no puede exceder 500 caracteres')
})

// Schema para subir foto de entrega
export const deliveryPhotoSchema = z.object({
  url: z.string().url('URL de imagen no válida'),
  publicId: z.string().optional()
})

// Tipos exportados
export type CreateRideInput = z.infer<typeof createRideSchema>
export type UpdateRideInput = z.infer<typeof updateRideSchema>
export type AcceptRideInput = z.infer<typeof acceptRideSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
export type CancelRideInput = z.infer<typeof cancelRideSchema>
export type DeliveryPhotoInput = z.infer<typeof deliveryPhotoSchema>
