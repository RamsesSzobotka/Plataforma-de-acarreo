/**
 * useDriverLocation
 *
 * Hook para que el conductor comparta su ubicación en tiempo real
 * durante un viaje activo (status === 'in_progress').
 *
 * Conecta al tracking WebSocket para enviar ubicación cada 5 segundos.
 * Se activa automáticamente al detectar rideStatus 'in_progress'.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { connectTracking, sendTrackingLocation, disconnectTracking } from '../services/tracking-ws'

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
  }, [rideStatus, rideId, enabled])

  async function startSharing() {
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

    // Iniciar watchPosition cada 5 segundos
    if (watchIdRef.current !== null) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
        }

        setLocation({ latitude: coords.latitude, longitude: coords.longitude })
        setError(null)

        if (!isSharingRef.current) {
          isSharingRef.current = true
          setIsSharing(true)
        }

        // Enviar por WebSocket
        sendTrackingLocation(rideId, coords)
      },
      (err) => {
        console.error('Error getting location:', err)
        setError('Error al obtener ubicación: ' + err.message)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    )
  }

  const stopSharing = useCallback(() => {
    // Limpiar watchPosition
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    // Desconectar WebSocket
    disconnectTracking()

    isSharingRef.current = false
    setIsSharing(false)
  }, [])

  // Cleanup total al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
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
