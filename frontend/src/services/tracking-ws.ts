/**
 * Tracking WebSocket Service
 *
 * Instancia SEPARADA del wsService de chat.
 * Conecta a /ws/tracking/:rideId para enviar ubicación del conductor.
 */
import { WebSocketService } from './api'

// Instancia propia — NO compartida con el chat
export const trackingWsService = new WebSocketService()

/**
 * Conectar al tracking WebSocket.
 * Usa pathPrefix '/ws/tracking/' para apuntar al endpoint correcto.
 */
export function connectTracking(rideId: string, token: string) {
  trackingWsService.connect(rideId, token, '/ws/tracking/')
}

/**
 * Enviar ubicación del conductor
 */
export function sendTrackingLocation(
  rideId: string,
  coords: {
    latitude: number
    longitude: number
    heading?: number
    speed?: number
  },
) {
  if (trackingWsService.getState().isConnected) {
    trackingWsService.send({
      type: 'location_update',
      rideId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: coords.heading ?? 0,
      speed: coords.speed ?? 0,
    })
  }
}

/**
 * Desconectar tracking
 */
export function disconnectTracking() {
  trackingWsService.disconnect()
}
