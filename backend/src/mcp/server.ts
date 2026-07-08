import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError as SdkMcpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { McpError as CustomMcpError } from './errors';
import { getTool, listTools, registerTool } from './tools/index';
import { writeAuditEvent, AuditAction } from './audit';

import { listMyRidesSchema, createRideSchema, getRideDetailsSchema, viewOffersSchema, acceptOfferSchema, confirmDeliverySchema, cancelRideSchema, rateServiceSchema, proposePriceSchema, listAvailableRidesSchema, sendMessageSchema, startTripSchema, uploadDeliveryPhotoSchema, getPaymentHistorySchema, getDriverProfileSchema, getPublicDriverProfileSchema } from './schemas';

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

let toolsRegistered = false;

export function registerAllTools() {
  if (toolsRegistered) return;
  toolsRegistered = true;
  const register = (name: string, description: string, schema: any, handler: any) => {
    registerTool({ name, description, schema, handler });
  };
  // Tools registered without userId — will be injected via closure in createMcpServer
  register('list_my_rides', 'Listar mis acarreos como cliente o conductor. Filtra por estado, página y límite. Incluye perfil del conductor asignado cuando aplica.', listMyRidesSchema, handleListMyRides);
  register('create_ride', 'Crear un nuevo pedido de acarreo. Requiere mínimo 1 imagen (subir antes con POST /api/upload) y método de pago guardado en el perfil.', createRideSchema, handleCreateRide);
  register('get_ride_details', 'Obtener detalles completos de un acarreo por su ID.', getRideDetailsSchema, handleGetRideDetails);
  register('view_offers', 'Ver ofertas recibidas para un acarreo.', viewOffersSchema, handleViewOffers);
  register('accept_offer', 'Aceptar una oferta de un conductor para un acarreo. El cliente selecciona cuál oferta aceptar. Se rechazarán automáticamente las demás ofertas pendientes.', acceptOfferSchema, handleAcceptOffer);
  register('confirm_delivery', 'Confirmar la entrega de un acarreo. Cambia el estado a completado e intenta el cobro automático con el método de pago guardado. Si no hay método de pago, entrega igual pero reporta que se requiere una tarjeta.', confirmDeliverySchema, handleConfirmDelivery);
  register('cancel_ride', 'Cancelar un acarreo (cliente) o retirarse como conductor asignado. Cliente: cancela con reembolso. Conductor: se retira y la publicación vuelve a solicitada.', cancelRideSchema, handleCancelRide);
  register('rate_service', 'Calificar el servicio de un acarreo completado (1-5 estrellas). Solo disponible después del pago.', rateServiceSchema, handleRateService);
  register('get_public_driver_profile', 'Obtener el perfil público de un conductor por su ID. Incluye rating, total de acarreos, tipo de vehículo, placa y estado de verificación.', getPublicDriverProfileSchema, handleGetPublicDriverProfile);

  // ── Driver Tools ──────────────────────────────────────────────────────
  register('list_available_rides', 'Listar acarreos disponibles para un conductor. Solo muestra acarreos en estado "solicitado" sin conductor asignado. Conductores suspendidos ven lista vacía. Si el conductor no está verificado, puede ver los acarreos pero no puede proponer.', listAvailableRidesSchema, handleListAvailableRides);
  register('propose_price', 'Proponer un precio para un acarreo. Solo conductores verificados pueden proponer. Si ya tienes una oferta pendiente en ese acarreo, se actualiza el monto existente. No se puede proponer en tu propio acarreo ni en acarreos ya asignados.', proposePriceSchema, handleProposePrice);
  register('send_message', 'Enviar un mensaje en un acarreo. Tanto el cliente como el conductor pueden enviar mensajes. El cliente debe ser el propietario del acarreo; el conductor debe tener una oferta (pendiente/aceptada) o ser el conductor asignado. Los mensajes se guardan en el historial del acarreo.', sendMessageSchema, handleSendMessage);
  register('start_trip', 'Iniciar un viaje. Solo conductores verificados que estén asignados a un acarreo en estado "aceptado" pueden iniciar. Cambia el estado del acarreo a "en progreso".', startTripSchema, handleStartTrip);
  register('upload_delivery_photo', 'Subir una foto de la entrega. Solo el conductor asignado puede subir la foto cuando el viaje está en progreso. IMPORTANTE: Esto NO cambia el estado a completado — el cliente debe confirmar la entrega.', uploadDeliveryPhotoSchema, handleUploadDeliveryPhoto);
  register('get_payment_history', 'Ver historial de pagos recibidos. Lista todos los acarreos pagados con el monto final, comisión de plataforma (10%) y el monto del conductor (90%). Ordenado por fecha de pago descendente.', getPaymentHistorySchema, handleGetPaymentHistory);
  register('get_driver_profile', 'Obtener el perfil del conductor autenticado. Muestra el estado de verificación, datos del vehículo, calificación y los permisos actuales basados en el estado de verificación.', getDriverProfileSchema, handleGetDriverProfile);
}

export function createMcpServer(clerkId: string) {
  registerAllTools();

  const mcpServer = new Server(
    { name: 'carglyn-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = listTools();
    return {
      tools: tools.map((t) => {
        const jsonSchema = zodToJsonSchema(t.schema, { target: 'jsonSchema7' }) as Record<string, unknown>;
        const { $schema, ...inputSchema } = jsonSchema;
        return {
          name: t.name,
          description: t.description,
          inputSchema: inputSchema as { type: 'object'; properties?: Record<string, unknown> },
        };
      }),
    };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const rawArgs = (args ?? {}) as Record<string, unknown>;
    const start = Date.now();

    // Map tool name to audit action
    const toolToAuditAction: Record<string, AuditAction> = {
      'create_ride': 'mcp.tool.create_ride',
      'accept_offer': 'mcp.tool.accept_offer',
      'propose_price': 'mcp.tool.propose_price',
      'cancel_ride': 'mcp.tool.cancel_ride',
      'start_trip': 'mcp.tool.start_trip',
      'upload_delivery_photo': 'mcp.tool.upload_delivery_photo',
      'confirm_delivery': 'mcp.tool.confirm_delivery',
      'rate_service': 'mcp.tool.rate_service',
      'send_message': 'mcp.tool.send_message',
    };

    try {
      const tool = getTool(name);
      if (!tool) throw new SdkMcpError(ErrorCode.MethodNotFound, `Tool desconocida: ${name}`);
      const parsed = tool.schema.parse(rawArgs);
      // clerkId comes from the closure — injected when createMcpServer(clerkId) was called
      const result = await tool.handler(parsed, undefined, undefined, clerkId);
      if (result && typeof result === 'object' && 'isError' in result && result.isError) {
        return { content: result.content, isError: true };
      }

      // Audit success
      const auditAction = toolToAuditAction[name];
      if (auditAction) {
        const resourceId = rawArgs.rideId as string || rawArgs.offerId as string || undefined;
        writeAuditEvent({
          clerkId,
          action: auditAction,
          toolName: name,
          resourceType: 'ride',
          resourceId,
          success: true,
          durationMs: Date.now() - start,
        }).catch(() => {});
      }

      return { content: result.content };
    } catch (error) {
      const auditAction = toolToAuditAction[name];
      if (auditAction) {
        const resourceId = rawArgs.rideId as string || rawArgs.offerId as string || undefined;
        writeAuditEvent({
          clerkId,
          action: auditAction,
          toolName: name,
          resourceType: 'ride',
          resourceId,
          success: false,
          errorCode: error instanceof CustomMcpError ? error.code : 'INTERNAL_ERROR',
          errorMessage: (error as Error).message,
          durationMs: Date.now() - start,
        }).catch(() => {});
      }

      if (error instanceof CustomMcpError) return { content: [{ type: 'text', text: JSON.stringify(error) }], isError: true };
      if (error instanceof SdkMcpError) return { content: [{ type: 'text', text: JSON.stringify(error) }], isError: true };
      if (error instanceof z.ZodError) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Datos inválidos', details: error.errors.map(e => ({ path: e.path.join('.'), message: e.message })) }) }], isError: true };
      throw error;
    }
  });

  return mcpServer;
}

/**
 * Validate an MCP token using O(1) lookup.
 *
 * Token format: mcp_<tokenId>_<secret>
 * - tokenId: 16-char hex identifier for DB lookup
 * - secret: random bytes that are hashed in the DB
 * - full token: mcp_<tokenId>_<secret> (stored as hash)
 *
 * Flow:
 * 1. Parse tokenId from the token string
 * 2. O(1) lookup by tokenId in DB
 * 3. Compare full token against stored hash
 * 4. Update lastUsedAt (fire-and-forget)
 */
export async function validateMcpToken(token: string): Promise<string | null> {
  try {
    // Token must start with 'mcp_' prefix
    if (!token.startsWith('mcp_')) {
      return null;
    }

    // Token format: mcp_<tokenId>_<secret>
    // tokenId es siempre hex (sin _), pero secret es base64url (PUEDE contener _)
    // Por eso NO podemos usar split('_') directo — extraemos solo el primer segmento
    const withoutPrefix = token.slice(4); // Remove 'mcp_'
    const firstUnderscore = withoutPrefix.indexOf('_');
    if (firstUnderscore <= 0) {
      return null;
    }
    const tokenId = withoutPrefix.slice(0, firstUnderscore);
    const secret = withoutPrefix.slice(firstUnderscore + 1);
    if (!tokenId || !secret) {
      return null;
    }

    // O(1) lookup by tokenId - much faster than iterating all tokens
    const { db } = await import('../db/mongo');
    const { compare } = await import('bcryptjs');

    const tokenDoc = await db.collection('mcp_tokens').findOne({
      tokenId,
      revokedAt: null
    });

    if (!tokenDoc) {
      return null;
    }

    // Compare the full token against the stored hash
    // The full token includes the secret part that was never stored
    const fullToken = `mcp_${tokenId}_${secret}`;
    const match = await compare(fullToken, tokenDoc.tokenHash);

    if (!match) {
      return null;
    }

    // Update lastUsedAt asynchronously (fire-and-forget)
    db.collection('mcp_tokens').updateOne(
      { tokenId },
      { $set: { lastUsedAt: new Date() } }
    ).catch(() => {
      // Ignore errors - this is non-critical
    });

    return tokenDoc.clerkId;
  } catch {
    return null;
  }
}
