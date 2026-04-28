import { z } from 'zod'

// Schema para crear/actualizar perfil de usuario (desde Clerk webhook)
export const userProfileSchema = z.object({
  clerkId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  imageUrl: z.string().url().optional(),
  role: z.enum(['client', 'driver', 'admin']).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().optional()
})

// Schema para actualizar datos personales
export const updateUserSchema = z.object({
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  phone: z.string()
    .regex(/^[0-9+\-().\s]+$/, 'Número de teléfono inválido')
    .max(20)
    .optional(),
  imageUrl: z.string().url().optional()
}).strict()

// Tipos exportados
export type UserProfileInput = z.infer<typeof userProfileSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
