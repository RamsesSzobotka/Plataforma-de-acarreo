import { useState, useCallback } from 'react'
import { RideCardProps } from '../components/RideCard'
import { API_URL } from '../services/api'

interface RideListState {
  rides: RideCardProps[]
  loading: boolean
  error: string | null
  pagination: {
    total: number
    limit: number
    skip: number
    hasMore: boolean
  }
}

/**
 * Custom hook to fetch and manage ride list with geospatial filtering
 * 
 * Features:
 * - Fetches nearby rides using lat/lng/radius
 * - Pagination with loadMore support
 * - Debounced radius changes
 * - Error handling
 * 
 * @returns RideListState and control methods
 */
export const useRideList = () => {
  const [state, setState] = useState<RideListState>({
    rides: [],
    loading: false,
    error: null,
    pagination: {
      total: 0,
      limit: 20,
      skip: 0,
      hasMore: false,
    },
  })

  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  const fetchRides = useCallback(
    async (
      lat: number,
      lng: number,
      radius: number,
      skip: number = 0,
      token?: string,
    ) => {
      if (!token) {
        setState((prev) => ({
          ...prev,
          error: 'Authentication required',
          loading: false,
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }))

      try {
        const response = await fetch(
          `${API_URL}/api/rides?lat=${lat}&lng=${lng}&radius=${radius}&limit=20&skip=${skip}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch rides: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.success) {
          setState((prev) => ({
            ...prev,
            rides: skip === 0 ? data.data : [...prev.rides, ...data.data],
            loading: false,
            pagination: {
              total: data.pagination.total,
              limit: data.pagination.limit,
              skip: skip + data.data.length,
              hasMore: data.pagination.hasMore,
            },
          }))
        } else {
          throw new Error(data.error || 'Unknown error')
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch rides'
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          loading: false,
        }))
      }
    },
    [],
  )

  const handleRadiusChange = useCallback(
    (lat: number, lng: number, radius: number, token?: string) => {
      // Clear previous timer
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // Set new timer to debounce radius changes
      const timer = setTimeout(() => {
        fetchRides(lat, lng, radius, 0, token)
      }, 500)

      setDebounceTimer(timer)
    },
    [debounceTimer, fetchRides],
  )

  const loadMore = useCallback(
    (lat: number, lng: number, radius: number, token?: string) => {
      fetchRides(lat, lng, radius, state.pagination.skip, token)
    },
    [state.pagination.skip, fetchRides],
  )

  const reset = useCallback(() => {
    setState({
      rides: [],
      loading: false,
      error: null,
      pagination: {
        total: 0,
        limit: 20,
        skip: 0,
        hasMore: false,
      },
    })
  }, [])

  return {
    ...state,
    fetchRides,
    handleRadiusChange,
    loadMore,
    reset,
  }
}
