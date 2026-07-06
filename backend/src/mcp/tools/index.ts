import { z } from 'zod';

// ── Schemas (static import — schemas.ts has NO imports from tools/index) ──────
import {
  listMyRidesSchema,
  createRideSchema,
  getRideDetailsSchema,
  viewOffersSchema,
  acceptOfferSchema,
  confirmDeliverySchema,
  cancelRideSchema,
  rateServiceSchema,
  proposePriceSchema,
  listAvailableRidesSchema,
  sendMessageSchema,
  startTripSchema,
  uploadDeliveryPhotoSchema,
  getPaymentHistorySchema,
  getDriverProfileSchema,
  getPublicDriverProfileSchema,
} from '../schemas';

// ── Tool handlers (static import — handlers don't import from tools/index) ───
import { handleListMyRides } from './tools/client/list-my-rides';
import { handleCreateRide } from './tools/client/create-ride';
import { handleGetRideDetails } from './tools/client/get-ride-details';
import { handleViewOffers } from './tools/client/view-offers';
import { handleAcceptOffer } from './tools/client/accept-offer';
import { handleConfirmDelivery } from './tools/client/confirm-delivery';
import { handleCancelRide } from './tools/client/cancel-ride';
import { handleRateService } from './tools/client/rate-service';
import { handleGetPublicDriverProfile } from './tools/client/get-public-driver-profile';

import { handleListAvailableRides } from './tools/driver/list-available-rides';
import { handleProposePrice } from './tools/driver/propose-price';
import { handleSendMessage } from './tools/driver/send-message';
import { handleStartTrip } from './tools/driver/start-trip';
import { handleUploadDeliveryPhoto } from './tools/driver/upload-delivery-photo';
import { handleGetPaymentHistory } from './tools/driver/get-payment-history';
import { handleGetDriverProfile } from './tools/driver/get-driver-profile';

export type ToolHandler = (
  input: any,
  authToken?: string,
  apiClient?: any,
  userId?: string,
) => Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }>;

export interface ToolRegistration {
  name: string;
  description: string;
  schema: z.ZodSchema;
  handler: ToolHandler;
}

export interface ToolInfo {
  name: string;
  description: string;
  schema: z.ZodSchema;
}

const toolRegistry = new Map<string, ToolRegistration>();

let toolsRegistered = false;

export function registerTool(reg: ToolRegistration): void {
  toolRegistry.set(reg.name, reg);
}

export function getTool(name: string): ToolRegistration | undefined {
  return toolRegistry.get(name);
}

export function listTools(): ToolInfo[] {
  return Array.from(toolRegistry.values()).map(({ name, description, schema }) => ({ name, description, schema }));
}

// ── Register all tools (idempotent — safe to call multiple times) ──────────────
export function registerAllTools(): void {
  if (toolsRegistered) return;
  toolsRegistered = true;

  const register = (name: string, description: string, schema: z.ZodSchema, handler: ToolHandler) => {
    registerTool({ name, description, schema, handler });
  };

  // Client tools
  register('list_my_rides', 'Listar mis acarreos como cliente o conductor. Filtra por estado, página y límite. Incluye perfil del conductor asignado cuando aplica.', listMyRidesSchema, handleListMyRides);
  register('create_ride', 'Crear un nuevo pedido de acarreo. Requiere mínimo 1 imagen (subir antes con POST /api/upload) y método de pago guardado en el perfil.', createRideSchema, handleCreateRide);
  register('get_ride_details', 'Obtener detalles completos de un acarreo por su ID.', getRideDetailsSchema, handleGetRideDetails);
  register('view_offers', 'Ver ofertas recibidas para un acarreo.', viewOffersSchema, handleViewOffers);
  register('accept_offer', 'Aceptar una oferta de un conductor para un acarreo. El cliente selecciona cuál oferta aceptar. Se rechazarán automáticamente las demás ofertas pendientes.', acceptOfferSchema, handleAcceptOffer);
  register('confirm_delivery', 'Confirmar la entrega de un acarreo. Cambia el estado a completado e intenta el cobro automático con el método de pago guardado. Si no hay método de pago, entrega igual pero reporta que se requiere una tarjeta.', confirmDeliverySchema, handleConfirmDelivery);
  register('cancel_ride', 'Cancelar un acarreo en estado requested.', cancelRideSchema, handleCancelRide);
  register('rate_service', 'Calificar el servicio de un acarreo completado (1-5 estrellas). Solo disponible después del pago.', rateServiceSchema, handleRateService);
  register('get_public_driver_profile', 'Obtener el perfil público de un conductor por su ID. Incluye rating, total de acarreos, tipo de vehículo, placa y estado de verificación.', getPublicDriverProfileSchema, handleGetPublicDriverProfile);

  // Driver tools
  register('list_available_rides', 'Listar acarreos disponibles para un conductor. Solo muestra acarreos en estado "solicitado" sin conductor asignado. Conductores suspendidos ven lista vacía. Si el conductor no está verificado, puede ver los acarreos pero no puede proponer.', listAvailableRidesSchema, handleListAvailableRides);
  register('propose_price', 'Proponer un precio para un acarreo. Solo conductores verificados pueden proponer. Si ya tienes una oferta pendiente en ese acarreo, se actualiza el monto existente. No se puede proponer en tu propio acarreo ni en acarreos ya asignados.', proposePriceSchema, handleProposePrice);
  register('send_message', 'Enviar un mensaje en un acarreo. Tanto el cliente como el conductor pueden enviar mensajes. El cliente debe ser el propietario del acarreo; el conductor debe tener una oferta (pendiente/aceptada) o ser el conductor asignado. Los mensajes se guardan en el historial del acarreo.', sendMessageSchema, handleSendMessage);
  register('start_trip', 'Iniciar un viaje. Solo conductores verificados que estén asignados a un acarreo en estado "aceptado" pueden iniciar. Cambia el estado del acarreo a "en progreso".', startTripSchema, handleStartTrip);
  register('upload_delivery_photo', 'Subir una foto de la entrega. Solo el conductor asignado puede subir la foto cuando el viaje está en progreso. IMPORTANTE: Esto NO cambia el estado a completado — el cliente debe confirmar la entrega.', uploadDeliveryPhotoSchema, handleUploadDeliveryPhoto);
  register('get_payment_history', 'Ver historial de pagos recibidos. Lista todos los acarreos pagados con el monto final, comisión de plataforma (10%) y el monto del conductor (90%). Ordenado por fecha de pago descendente.', getPaymentHistorySchema, handleGetPaymentHistory);
  register('get_driver_profile', 'Obtener el perfil del conductor autenticado. Muestra el estado de verificación, datos del vehículo, calificación y los permisos actuales basados en el estado de verificación.', getDriverProfileSchema, handleGetDriverProfile);
}