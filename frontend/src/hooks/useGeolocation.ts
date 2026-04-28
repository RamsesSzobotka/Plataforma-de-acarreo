import { useState, useEffect, useCallback } from 'react'

export interface GeolocationState {
  lat: number | null
  lng: number | null
  accuracy: number | null
  loading: boolean
  error: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | null
  timestamp: number | null
  refetch: () => void
  clearCache: () => void
}

const CACHE_KEY = 'driverLocation'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Custom hook to get driver's geolocation
 * 
 * Features:
 * - Requests device location on mount
 * - Caches location for 5 minutes (localStorage)
 * - Retry logic (up to 3 attempts)
 * - Fallback for permission denied
 * 
 * @returns GeolocationState with lat, lng, loading, error, and control methods
 */
export const useGeolocation = (): GeolocationState => {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    loading: true,
    error: null,
    timestamp: null,
    refetch: () => {},
    clearCache: () => {},
  })

  const getCachedLocation = useCallback((): GeolocationState | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return null

      const parsed = JSON.parse(cached)
      const now = Date.now()

      // Check if cache is still valid
      if (now - parsed.timestamp < CACHE_DURATION) {
        return {
          ...parsed,
          loading: false,
          error: null,
          refetch: () => {},
          clearCache: () => {},
        }
      }

      // Cache expired, clear it
      localStorage.removeItem(CACHE_KEY)
      return null
    } catch (err) {
      console.error('Error reading cached location:', err)
      return null
    }
  }, [])

  const setCachedLocation = useCallback((lat: number, lng: number, accuracy: number) => {
    try {
      const data = {
        lat,
        lng,
        accuracy,
        timestamp: Date.now(),
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch (err) {
      console.error('Error caching location:', err)
    }
  }, [])

  const requestGeolocation = useCallback(async (retryCount = 0) => {
    // Check cache first
    const cached = getCachedLocation()
    if (cached) {
      setState((prev) => ({
        ...prev,
        lat: cached.lat,
        lng: cached.lng,
        accuracy: cached.accuracy,
        loading: false,
        error: null,
        timestamp: cached.timestamp,
      }))
      return
    }

    // Check if geolocation is available
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'POSITION_UNAVAILABLE',
      }))
      return
    }

    setState((prev) => ({ ...prev, loading: true }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setCachedLocation(latitude, longitude, accuracy)
        setState({
          lat: latitude,
          lng: longitude,
          accuracy,
          loading: false,
          error: null,
          timestamp: Date.now(),
          refetch: () => requestGeolocation(),
          clearCache: () => {
            localStorage.removeItem(CACHE_KEY)
            setState((prev) => ({
              ...prev,
              lat: null,
              lng: null,
              accuracy: null,
              timestamp: null,
            }))
          },
        })
      },
      (error) => {
        // Map geolocation errors to our error types
        let errorType: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' =
          'POSITION_UNAVAILABLE'

        if (error.code === error.PERMISSION_DENIED) {
          errorType = 'PERMISSION_DENIED'
        } else if (error.code === error.TIMEOUT) {
          errorType = 'TIMEOUT'
        }

        // Retry with exponential backoff
        if (retryCount < 2 && errorType !== 'PERMISSION_DENIED') {
          const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
          setTimeout(() => {
            requestGeolocation(retryCount + 1)
          }, delay)
          return
        }

        setState({
          lat: null,
          lng: null,
          accuracy: null,
          loading: false,
          error: errorType,
          timestamp: null,
          refetch: () => requestGeolocation(),
          clearCache: () => {
            localStorage.removeItem(CACHE_KEY)
          },
        })
      },
      {
        enableHighAccuracy: false,
        timeout: 45000, // 45 seconds
        maximumAge: 300000, // Allow cached position up to 5 minutes old
      },
    )
  }, [getCachedLocation, setCachedLocation])

  // Request geolocation on mount
  useEffect(() => {
    requestGeolocation()
  }, [requestGeolocation])

  return state
}
