/**
 * useDriverLocation
 *
 * Hook para que el conductor comparta su ubicación en tiempo real
 * durante un viaje activo (status === 'in_progress').
 *
 * Usa watchPosition como método principal (ideal en teléfonos con GPS).
 * Añade polling con getCurrentPosition cada MIN_SEND_INTERVAL como fallback
 * para dispositivos sin GPS (desktops) donde watchPosition no dispara
 * callbacks consistentemente.
 *
 * Ambos mecanismos comparten el mismo throttle (lastSentRef), sin duplicados.
 *
 * Conexión: tracking WebSocket a /ws/tracking/:rideId
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { connectTracking, sendTrackingLocation, disconnectTracking } from '../services/tracking-ws'

const MIN_SEND_INTERVAL = 10000 // 10 segundos entre envío y envío
const POLLING_INTERVAL = 15000 // 15s — polling fallback si watchPosition no dispara

interface UseDriverLocationOptions {
  rideId: string
  rideStatus: string
  getToken: () => Promise<string | null>
  enabled?: boolean
}

interface UseDriverLocationReturn {
  isSharing: boolean
  error: string | null
  supported: boolean
  location: { latitude: number; longitude: number } | null
}

export function useDriverLocation({
  rideId,
  rideStatus,
  getToken,
  enabled = true,
}: UseDriverLocationOptions): UseDriverLocationReturn {
  const [isSharing, setIsSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supported] = useState(() => !!navigator.geolocation)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const isSharingRef = useRef(false)
  const wasInProgress = useRef(false)
  const lastSentRef = useRef<number>(0)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Ayudante: toma coordenadas y envía si pasó el throttle
  const trySendLocation = useCallback((latitude: number, longitude: number, heading?: number, speed?: number) => {
    const now = Date.now()
    if (now - lastSentRef.current < MIN_SEND_INTERVAL) return

    lastSentRef.current = now
    setLocation({ latitude, longitude })
    setError(null)

    if (!isSharingRef.current) {
      isSharingRef.current = true
      setIsSharing(true)
    }

    console.log('[TRACKING] Sending location update, rideId:', rideId, 'coords:', { latitude, longitude })
    sendTrackingLocation(rideId, { latitude, longitude, heading, speed })
  }, [rideId])

  async function startSharing() {
    console.log('[TRACKING] startSharing called, rideId:', rideId)
    if (!supported || !rideId) return

    setError(null)

    // Conectar WebSocket de tracking
    try {
      const token = await getToken()
      if (token) {
        connectTracking(rideId, token)
      }
    } catch (err) {
      console.error('Error connecting tracking WS:', err)
    }

    // ── Primero: watchPosition (GPS nativo, ideal en móviles) ──
    if (watchIdRef.current === null) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          trySendLocation(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.heading ?? undefined,
            pos.coords.speed ?? undefined,
          )
        },
        (err) => {
          console.error('[TRACKING] watchPosition error:', err.message)
          setError('Error al obtener ubicación: ' + err.message)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        },
      )
    }

    // ── Segundo: polling fallback con getCurrentPosition ──
    // Útil en desktops sin GPS donde watchPosition nunca dispara.
    // Comparte lastSentRef para no duplicar envíos si watchPosition sí funciona.
    if (pollingIntervalRef.current === null) {
      const poll = () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            trySendLocation(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.heading ?? undefined,
              pos.coords.speed ?? undefined,
            )
          },
          () => { /* polling fallback silencioso — no mostrar error si falla */ },
          { enableHighAccuracy: false, maximumAge: 15000, timeout: 8000 },
        )
      }
      // Primer poll inmediato + luego cada POLLING_INTERVAL
      poll()
      pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL)
    }
  }

  const stopSharing = useCallback(() => {
    // Limpiar watchPosition
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    // Limpiar polling interval
    if (pollingIntervalRef.current !== null) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    // Desconectar WebSocket
    disconnectTracking()

    // Resetear refs para el próximo viaje
    lastSentRef.current = 0
    isSharingRef.current = false
    wasInProgress.current = false  // CRITICAL: permite que el próximo in_progress vuelva a iniciar tracking
    setIsSharing(false)
  }, [])

  // ── Detectar cuando el viaje pasa a in_progress o se completa ──
  useEffect(() => {
    if (!enabled || !rideId) {
      stopSharing()
      return
    }

    const isInProgress = rideStatus === 'in_progress'

    if (isInProgress && !wasInProgress.current) {
      // Transición a in_progress → iniciar tracking
      wasInProgress.current = true
      startSharing()
    } else if (!isInProgress && wasInProgress.current) {
      // Transición fuera de in_progress → detener tracking
      wasInProgress.current = false
      stopSharing()
    }

    return () => {
      // Cleanup al desmontar
      if (wasInProgress.current) {
        stopSharing()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideStatus, rideId, enabled])

  // Cleanup total al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (pollingIntervalRef.current !== null) {
        clearInterval(pollingIntervalRef.current)
      }
      disconnectTracking()
    }
  }, [])

  return {
    isSharing,
    error,
    supported,
    location,
  }
}
