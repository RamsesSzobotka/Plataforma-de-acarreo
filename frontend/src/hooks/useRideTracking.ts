/**
 * useRideTracking
 *
 * Hook para que el cliente vea la ubicación en vivo del conductor.
 * Recibe eventos `driver_location` en tiempo real via wsService (chat WebSocket)
 * y también hace un fetch inicial de la última ubicación desde Redis via REST.
 *
 * CONECTA AUTOMÁTICAMENTE el chat WebSocket cuando el ride está 'in_progress'
 * para asegurar que los eventos de tracking lleguen incluso si el usuario
 * no abrió la página de Chat manualmente.
 */
import { useState, useEffect, useRef } from 'react'
import { wsService, ridesAPI } from '../services/api'

interface DriverLocation {
  latitude: number
  longitude: number
  heading: number
  speed: number
  timestamp: number
}

interface UseRideTrackingOptions {
  rideId: string
  rideStatus: string
  /** Función para obtener el token JWT (requerido para conectar el WS automáticamente) */
  getToken?: () => Promise<string | null>
}

interface UseRideTrackingReturn {
  driverLocation: DriverLocation | null
  isTracking: boolean
}

export function useRideTracking({
  rideId,
  rideStatus,
  getToken,
}: UseRideTrackingOptions): UseRideTrackingReturn {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const prevRideIdRef = useRef('')
  const tokenRef = useRef(getToken)
  tokenRef.current = getToken

  useEffect(() => {
    if (!rideId) return

    const isInProgress = rideStatus === 'in_progress'
    const rideChanged = rideId !== prevRideIdRef.current
    prevRideIdRef.current = rideId

    // ── IN_PROGRESS → Iniciar tracking ──
    if (isInProgress) {
      // Si cambió el rideId estando en in_progress, desuscribir callback anterior
      if (rideChanged && unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }

      setIsTracking(true)

      // Suscribirse a eventos driver_location en wsService
      if (!unsubscribeRef.current) {
        const unsub = wsService.onMessage((data: any) => {
          if (data.type === 'driver_location') {
            setDriverLocation({
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading ?? 0,
              speed: data.speed ?? 0,
              timestamp: data.timestamp ?? Date.now(),
            })
          }
        })
        unsubscribeRef.current = unsub
      }

      // AUTO-CONECTAR el chat WebSocket si no está conectado al mismo ride.
      // El backend envía 'driver_location' a la sala del chat WS, así que
      // el cliente DEBE estar conectado al chat WS para recibirlo.
      const state = wsService.getState()
      if (!state.isConnected || state.rideId !== rideId) {
        ;(async () => {
          try {
            const token = await tokenRef.current?.()
            if (token && rideId) {
              wsService.connect(rideId, token)
            }
          } catch (err) {
            console.error('Error auto-connecting chat WS for tracking:', err)
          }
        })()
      }

      // ── FETCH INICIAL: Obtener última ubicación desde Redis ──
      // Esto permite que el mapa muestre la ubicación del conductor
      // INMEDIATAMENTE al cargar la página, sin esperar el próximo
      // evento por WebSocket (~5s de intervalo del driver).
      ;(async () => {
        try {
          const token = await tokenRef.current?.()
          if (token) {
            const response = await ridesAPI.getDriverLocation(rideId, token)
            if (response.data) {
              setDriverLocation({
                latitude: response.data.latitude,
                longitude: response.data.longitude,
                heading: response.data.heading ?? 0,
                speed: response.data.speed ?? 0,
                timestamp: response.data.updatedAt ?? Date.now(),
              })
            }
          }
        } catch (err) {
          // Si falla el fetch inicial (Redis caído, etc.), no es crítico.
          // El WebSocket eventualmente recibirá la próxima actualización.
          console.warn('⚠️ Error fetching initial driver location:', err)
        }
      })()

    // ── NO in_progress → Detener tracking ──
    } else if (isTracking) {
      setIsTracking(false)
      setDriverLocation(null)
    }

    // Cleanup por cambio de dependencias
    return () => {
      // No desuscribimos aquí porque el wsService puede estar siendo
      // usado por el chat. Solo limpiamos al desmontar.
    }
  }, [rideStatus, rideId])

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      prevRideIdRef.current = ''
      setIsTracking(false)
      setDriverLocation(null)
    }
  }, [])

  return {
    driverLocation,
    isTracking,
  }
}
