import type { Ride, PaginatedResponse } from '../types'

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

  get: (token: string, id: string) => fetchWithClerk<Ride>(`/api/rides/${id}`, token),

  create: (token: string, data: Partial<Ride>) =>
    fetchWithClerk<Ride>('/api/rides', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}