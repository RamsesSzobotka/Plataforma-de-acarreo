/**
 * WebSocket Service
 *
 * Maneja las conexiones WebSocket por sala (rideId) y el broadcast de eventos.
 * Extraído de index.ts para eliminar la dependencia circular (messages.ts ← index.ts).
 */

import type { ServerWebSocket } from 'bun'

// ── Tipos ───────────────────────────────────────────────────
export interface WsConnection {
  ws: ServerWebSocket<WsData>
  clerkId: string
}

export interface WsData {
  rideId: string
  authenticated: boolean
  clerkId: string | null
}

// ── Almacén en memoria: rideId → Set de conexiones ──────────
const wsConnections = new Map<string, Set<WsConnection>>()

// ── API pública ──────────────────────────────────────────────

/** Obtener todas las conexiones (para inspección/debug) */
export function getWsConnections(): Map<string, Set<WsConnection>> {
  return wsConnections
}

/** Broadcast de un evento a todos los miembros de una sala */
export function broadcastToRide(rideId: string, data: any) {
  const connections = wsConnections.get(rideId)
  if (!connections) return
  const message = JSON.stringify(data)
  connections.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message)
  })
}

/** Agregar una conexión autenticada a una sala */
export function addConnection(rideId: string, ws: ServerWebSocket<WsData>, clerkId: string) {
  if (!wsConnections.has(rideId)) wsConnections.set(rideId, new Set())
  wsConnections.get(rideId)!.add({ ws, clerkId })
}

/** Remover una conexión de todas las salas */
export function removeConnection(ws: ServerWebSocket<WsData>) {
  for (const [rideId, connections] of wsConnections) {
    for (const conn of connections) {
      if (conn.ws === ws) {
        connections.delete(conn)
        if (connections.size === 0) wsConnections.delete(rideId)
        return
      }
    }
  }
}
