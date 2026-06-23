import { z } from 'zod';

const rideStatusEnum = z.enum([
  'requested',
  'negotiating',
  'accepted',
  'in_progress',
  'completed',
  'paid',
  'cancelled',
]);

const rideTypeEnum = z.enum([
  'mudanza',
  'electrodomesticos',
  'electrodomésticos',
  'muebles',
  'productos',
  'otros',
]);

const paginationSchema = {
  page: z.coerce.number().int().min(1).optional().default(1).describe('Número de página (default: 1)'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10).describe('Elementos por página (max: 50)'),
};

export const listMyRidesSchema = z.object({
  status: rideStatusEnum.optional().describe('Filtrar por estado del acarreo'),
  ...paginationSchema,
});

export const createRideSchema = z.object({
  title: z.string().min(3).max(200).describe('Título descriptivo del acarreo'),
  description: z.string().min(10).max(2000).describe('Descripción detallada de la carga'),
  type: rideTypeEnum.describe('Tipo de acarreo'),
  pickupAddress: z.string().min(5).max(500).describe('Dirección de recogida'),
  pickupLat: z.number().min(-90).max(90).describe('Latitud de recogida'),
  pickupLng: z.number().min(-180).max(180).describe('Longitud de recogida'),
  dropoffAddress: z.string().min(5).max(500).describe('Dirección de destino'),
  dropoffLat: z.number().min(-90).max(90).describe('Latitud de destino'),
  dropoffLng: z.number().min(-180).max(180).describe('Longitud de destino'),
  estimatedPrice: z.number().positive().describe('Precio sugerido en USD'),
  packages: z.number().int().positive().optional().describe('Número aproximado de bultos'),
  notes: z.string().max(1000).optional().describe('Notas especiales (frágil, requiere ayuda, etc.)'),
  preferredDate: z.string().datetime().optional().describe('Fecha preferida en formato ISO 8601 (ej: 2026-06-19T14:30:00Z)'),
});

export const getRideDetailsSchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo'),
});

export const viewOffersSchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo'),
});

export const acceptOfferSchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo'),
  driverId: z.string().min(1).describe('ID del conductor (clerkId)'),
  agreedPrice: z.number().positive().optional().describe('Precio acordado con el conductor'),
});

export const confirmDeliverySchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo a confirmar'),
});

export const cancelRideSchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo a cancelar'),
  reason: z.string().min(1).max(500).optional().describe('Motivo de la cancelación'),
});

export const rateServiceSchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo'),
  rating: z.number().int().min(1).max(5).describe('Calificación de 1 a 5 estrellas'),
  comment: z.string().max(1000).optional().describe('Comentario opcional sobre la calificación'),
});
