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

const roleEnum = z.enum(['client', 'driver']);

const newStatusEnum = z.enum(['in_progress', 'completed']);

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

export const listAvailableRidesSchema = z.object({
  lat: z.number().min(-90).max(90).describe('Latitud del conductor'),
  lng: z.number().min(-180).max(180).describe('Longitud del conductor'),
  radiusKm: z.coerce.number().positive().max(100).optional().default(20).describe('Radio de búsqueda en km (max: 100)'),
  ...paginationSchema,
});

export const getAvailableRideDetailsSchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo'),
  lat: z.number().min(-90).max(90).optional().describe('Latitud del conductor (para calcular distancia)'),
  lng: z.number().min(-180).max(180).optional().describe('Longitud del conductor (para calcular distancia)'),
});

export const sendOfferSchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo'),
  price: z.number().positive().describe('Precio propuesto por el conductor'),
  message: z.string().max(500).optional().describe('Mensaje opcional para el cliente'),
});

export const viewOffersSchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo'),
});

export const acceptOfferSchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo'),
  driverId: z.string().min(1).describe('ID del conductor (clerkId)'),
  agreedPrice: z.number().positive().optional().describe('Precio acordado con el conductor'),
});

export const updateRideStatusSchema = z.object({
  rideId: z.string().min(1).describe('ID del acarreo'),
  newStatus: newStatusEnum.describe('Nuevo estado: en_camino (in_progress) o entregado (completed)'),
  statusNote: z.string().max(500).optional().describe('Nota opcional sobre el estado'),
  deliveryPhotoBase64: z.string().optional().describe('Foto de entrega en base64 (solo para completed)'),
});

export const getRideHistorySchema = z.object({
  role: roleEnum.describe('Rol del usuario que consulta'),
  ...paginationSchema,
});
