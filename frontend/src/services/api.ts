import type { Ride, PaginatedResponse } from '../types'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * Helper para fetch con Clerk token. Usa dentro de componentes con useAuth() hook
 * @param token - El token de Clerk (obtenido con getToken())
 */
export async function fetchWithClerk<T>(
  endpoint: string, 
  token: string | null | Promise<string>,
  options?: RequestInit
): Promise<T> {
  const resolvedToken = token instanceof Promise ? await token : token
  
  // El proxy de Vite reenvía /api/* a localhost:3000
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(resolvedToken && { Authorization: `Bearer ${resolvedToken}` }),
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || error.message || 'Request failed')
  }

  return response.json()
}

// Rides API - pasar token como segundo argumento
export const ridesAPI = {
  list: (token: string, params?: { status?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchWithClerk<PaginatedResponse<Ride>>(`/api/rides${query ? `?${query}` : ''}`, token)
  },

  nearby: (
    token: string,
    params: {
      lat: number
      lng: number
      radius: number
      limit?: number
      skip?: number
    },
  ) => {
    const searchParams = new URLSearchParams()
    searchParams.set('lat', String(params.lat))
    searchParams.set('lng', String(params.lng))
    searchParams.set('radius', String(params.radius))
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.skip) searchParams.set('skip', String(params.skip))
    return fetchWithClerk<any>(`/rides?${searchParams.toString()}`, token)
  },

  get: (token: string, id: string, params?: { driverLat?: number; driverLng?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.driverLat) searchParams.set('driverLat', String(params.driverLat))
    if (params?.driverLng) searchParams.set('driverLng', String(params.driverLng))
    const query = searchParams.toString()
    return fetchWithClerk<any>(`/rides/${id}${query ? `?${query}` : ''}`, token)
  },

  create: (token: string, data: Partial<Ride>) =>
    fetchWithClerk<Ride>('/rides', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  accept: (token: string, id: string, data?: { finalPrice?: number }) =>
    fetchWithClerk<any>(`/rides/${id}/accept`, token, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  cancel: (token: string, id: string, data: { reason: string }) =>
    fetchWithClerk<any>(`/rides/${id}/cancel`, token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}