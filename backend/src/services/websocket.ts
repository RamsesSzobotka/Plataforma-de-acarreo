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

// ── Almacén en memoria: userId → Set de conexiones ──────────
const userConnections = new Map<string, Set<WsConnection>>()

// ── API pública ──────────────────────────────────────────────

/** Obtener todas las conexiones (para inspección/debug) */
export function getWsConnections(): Map<string, Set<WsConnection>> {
  return wsConnections
}

/** Broadcast de un evento a todos los miembros de una sala */
export function broadcastToRide(rideId: string, data: any) {
  const connections = wsConnections.get(rideId)
  console.log(`📡 [WS] broadcastToRide: rideId=${rideId}, connectionCount=${connections?.size ?? 0}, type=${data.type}`)
  if (!connections) return
  const message = JSON.stringify(data)
  connections.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message)
  })
}

/** Broadcast de un evento a todas las conexiones de un usuario */
export function broadcastToUser(clerkId: string, data: any) {
  const connections = userConnections.get(clerkId)
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

/** Agregar una conexión autenticada al mapa de usuario */
export function addUserConnection(clerkId: string, ws: ServerWebSocket<WsData>) {
  if (!userConnections.has(clerkId)) userConnections.set(clerkId, new Set())
  userConnections.get(clerkId)!.add({ ws, clerkId })
}

/** Remover una conexión de todas las salas y del mapa de usuario */
export function removeConnection(ws: ServerWebSocket<WsData>) {
  for (const [rideId, connections] of wsConnections) {
    for (const conn of connections) {
      if (conn.ws === ws) {
        connections.delete(conn)
        if (connections.size === 0) wsConnections.delete(rideId)
        break
      }
    }
  }
  for (const [clerkId, connections] of userConnections) {
    for (const conn of connections) {
      if (conn.ws === ws) {
        connections.delete(conn)
        if (connections.size === 0) userConnections.delete(clerkId)
        break
      }
    }
  }
}
