import type { Ride, PaginatedResponse, Message } from '../types'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

let clerkTokenGetter: (() => Promise<string | null>) | null = null

export function setClerkTokenGetter(getter: () => Promise<string | null>) {
  clerkTokenGetter = getter
}

/**
 * Función base para hacer llamadas al API con autenticación automática
 * Obtiene el token de Clerk e incluye Bearer token en headers
 */
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit & { requiresAuth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }

  // Agregar autenticación si se requiere (por defecto sí)
  const requiresAuth = options?.requiresAuth !== false
  if (requiresAuth) {
    try {
      if (!clerkTokenGetter) {
        throw new Error('Clerk token getter no configurado. Asegúrate de usar <ClerkProvider> y configurar setClerkTokenGetter en tu app.')
      }
      const token = await clerkTokenGetter()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    } catch (err) {
      console.error('Error obtaining token from Clerk:', err)
      throw new Error('No se pudo obtener token de autenticación')
    }
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      let errorMessage = 'Error en la solicitud'
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
        if (errorData.details) {
          errorMessage = `${errorMessage}: ${JSON.stringify(errorData.details)}`
        }
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }

    return response.json() as Promise<T>
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw new Error('Error desconocido en la solicitud')
  }
}

/**
 * API para gestionar rides
 */
export const ridesAPI = {
  /**
   * Listar todos los rides (público)
   */
  list: (params?: { status?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<Ride>>(
      `/api/rides${query ? `?${query}` : ''}`,
      { requiresAuth: false }
    )
  },

  /**
   * Obtener mis rides (requiere auth)
   */
  myRides: (params?: { status?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<Ride>>(
      `/api/rides/user/me${query ? `?${query}` : ''}`,
      { requiresAuth: true }
    )
  },

  /**
   * Geospatial search para drivers (requiere auth)
   */
  nearby: (params: {
    lat: number
    lng: number
    radius: number
    limit?: number
    skip?: number
  }) => {
    const searchParams = new URLSearchParams()
    searchParams.set('lat', String(params.lat))
    searchParams.set('lng', String(params.lng))
    searchParams.set('radius', String(params.radius))
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.skip) searchParams.set('skip', String(params.skip))
    return fetchAPI<any>(
      `/api/rides?${searchParams.toString()}`,
      { requiresAuth: true }
    )
  },

  /**
   * Obtener un ride específico
   */
  get: (id: string, params?: { driverLat?: number; driverLng?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.driverLat) searchParams.set('driverLat', String(params.driverLat))
    if (params?.driverLng) searchParams.set('driverLng', String(params.driverLng))
    const query = searchParams.toString()
    return fetchAPI<Ride>(
      `/api/rides/${id}${query ? `?${query}` : ''}`,
      { requiresAuth: false }
    )
  },

  /**
   * Crear un nuevo ride (requiere auth + cliente)
   */
  create: (data: {
    title: string
    description: string
    type: string
    pickupLocation: { address: string; coordinates?: [number, number] }
    dropoffLocation: { address: string; coordinates?: [number, number] }
    estimatedPrice: number
    packages?: number
    weight?: number
    notes?: string
    images?: Array<{ url: string; publicId?: string }>
  }) =>
    fetchAPI<Ride>('/api/rides', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    }),

  /**
   * Actualizar un ride (requiere auth + propietario)
   */
  update: (id: string, data: Partial<Ride>) =>
    fetchAPI<Ride>(`/api/rides/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      requiresAuth: true,
    }),

  /**
   * Cambiar estado del ride
   */
  updateStatus: (id: string, status: string, reason?: string) =>
    fetchAPI<Ride>(`/api/rides/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
      requiresAuth: true,
    }),

  /**
   * Aceptar un ride como conductor
   */
  accept: (id: string, agreedPrice: number) =>
    fetchAPI<Ride>(`/api/rides/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ agreedPrice }),
      requiresAuth: true,
    }),

  /**
   * Iniciar viaje (confirmar carga)
   */
  start: (id: string) =>
    fetchAPI<Ride>(`/api/rides/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({}),
      requiresAuth: true,
    }),

  /**
   * Subir foto de entrega
   */
  deliveryPhoto: (id: string, url: string, publicId?: string) =>
    fetchAPI<Ride>(`/api/rides/${id}/delivery-photo`, {
      method: 'POST',
      body: JSON.stringify({ url, publicId }),
      requiresAuth: true,
    }),

  /**
   * Cancelar un ride
   */
  cancel: (id: string, cancellationReason: string) =>
    fetchAPI<Ride>(`/api/rides/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancellationReason }),
      requiresAuth: true,
    }),
}

/**
 * API para gestionar mensajes
 */
export const messagesAPI = {
  /**
   * Obtener mensajes de un ride
   */
  getByRide: (rideId: string, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<Message>>(
      `/api/messages/ride/${rideId}${query ? `?${query}` : ''}`,
      { requiresAuth: false }
    )
  },

  /**
   * Enviar un mensaje
   */
  send: (rideId: string, content: string) =>
    fetchAPI<Message>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ rideId, content }),
      requiresAuth: true,
    }),

  /**
   * Marcar mensajes como leídos
   */
  markAsRead: (rideId: string) =>
    fetchAPI<{ success: boolean }>(`/api/messages/ride/${rideId}/read`, {
      method: 'PATCH',
      body: JSON.stringify({}),
      requiresAuth: true,
    }),
}

/**
 * API para gestionar usuarios
 */
export const usersAPI = {
  /**
   * Obtener perfil de un conductor
   */
  getDriver: (userId: string) =>
    fetchAPI<any>(`/api/users/driver/${userId}`, { requiresAuth: false }),

  /**
   * Obtener mi perfil de conductor
   */
  getMyDriver: () =>
    fetchAPI<any>('/api/users/driver/me', { requiresAuth: true }),

  /**
   * Actualizar disponibilidad del conductor
   */
  updateDriverAvailability: (isAvailable: boolean) =>
    fetchAPI<any>(`/api/users/driver/me/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
      requiresAuth: true,
    }),

  /**
   * Actualizar ubicación del conductor
   */
  updateDriverLocation: (coordinates: [number, number]) =>
    fetchAPI<any>(`/api/users/driver/me/location`, {
      method: 'PATCH',
      body: JSON.stringify({ coordinates }),
      requiresAuth: true,
    }),

  /**
   * Registrarse como conductor
   */
  registerDriver: (data: {
    vehicleType: string
    plate: string
    capacityKg: number
  }) =>
    fetchAPI<any>('/api/users/register-driver', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: true,
    }),
}

// Payments API
export const paymentsAPI = {
  createPaymentIntent: (rideId: string, amount: number) =>
    fetchAPI<{ clientSecret: string; paymentIntentId: string }>(
      '/api/payments/create-intent',
      {
        method: 'POST',
        body: JSON.stringify({ rideId, amount }),
      }
    ),

  confirmPayment: (rideId: string, paymentIntentId: string) =>
    fetchAPI<{ success: boolean; paymentIntentId: string; status: string }>(
      '/api/payments/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ rideId, paymentIntentId }),
      }
    ),
}