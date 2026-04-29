import type { Ride, Message, PaginatedResponse } from '../types'

const API_URL = import.meta.env.VITE_API_URL || ''

// WebSocket connection helper
export class WebSocketService {
  private ws: WebSocket | null = null
  private rideId: string | null = null
  private onMessageCallback: ((data: any) => void) | null = null
  private onErrorCallback: ((error: Event) => void) | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(rideId: string, token: string) {
    if (this.ws?.readyState === WebSocket.OPEN && this.rideId === rideId) {
      return // Already connected to this ride
    }

    this.rideId = rideId
    const wsUrl = `${API_URL.replace('http', 'ws')}/ws/chat/${rideId}`
    
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      // Send auth token
      this.ws?.send(JSON.stringify({ type: 'auth', token }))
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.onMessageCallback?.(data)
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.onErrorCallback?.(error)
    }

    this.ws.onclose = () => {
      console.log('WebSocket disconnected')
      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        setTimeout(() => {
          if (this.rideId) {
            this.connect(this.rideId, token)
          }
        }, this.reconnectDelay * this.reconnectAttempts)
      }
    }
  }

  onMessage(callback: (data: any) => void) {
    this.onMessageCallback = callback
  }

  onError(callback: (error: Event) => void) {
    this.onErrorCallback = callback
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.rideId = null
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }
}

export const wsService = new WebSocketService()

async function fetchAPI<T>(endpoint: string, options?: RequestInit, token?: string): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || error.message || 'Request failed')
  }

  return response.json()
}

// Rides API
export const ridesAPI = {
  // Listar pedidos disponibles (para drivers)
  listAvailable: (params?: { type?: string; page?: number; limit?: number }, token?: string) => {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.set('type', params.type)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<Ride>>(`/api/rides/available${query ? `?${query}` : ''}`, {}, token)
  },

  // Listar rides (filtros por status, clientId, driverId)
  list: (params?: { status?: string; clientId?: string; driverId?: string; page?: number; limit?: number }, token?: string) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.clientId) searchParams.set('clientId', params.clientId)
    if (params?.driverId) searchParams.set('driverId', params.driverId)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<Ride>>(`/api/rides${query ? `?${query}` : ''}`, {}, token)
  },

  get: (id: string, token?: string) => fetchAPI<Ride>(`/api/rides/${id}`, {}, token),

  create: (data: Partial<Ride>, token?: string) =>
    fetchAPI<Ride>('/api/rides', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),

  update: (id: string, data: Partial<Ride>, token?: string) =>
    fetchAPI<Ride>(`/api/rides/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, token),

  updateStatus: (id: string, status: string, reason?: string, token?: string) =>
    fetchAPI<Ride>(`/api/rides/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }, token),

  accept: (id: string, driverId: string, agreedPrice: number, token?: string) =>
    fetchAPI<Ride>(`/api/rides/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ driverId, agreedPrice }),
    }, token),

  cancel: (id: string, reason: string, token?: string) =>
    fetchAPI<Ride>(`/api/rides/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }, token),

  // Iniciar viaje (driver confirma carga)
  start: (id: string, token?: string) =>
    fetchAPI<{ success: boolean; message: string; ride: Ride }>(`/api/rides/${id}/start`, {
      method: 'POST',
    }, token),

  // Subir foto de entrega
  deliveryPhoto: (id: string, url: string, publicId?: string, token?: string) =>
    fetchAPI<{ success: boolean; message: string; ride: Ride }>(`/api/rides/${id}/delivery-photo`, {
      method: 'POST',
      body: JSON.stringify({ url, publicId }),
    }, token),

  // Confirmar entrega (cliente)
  confirmDelivery: (id: string, token?: string) =>
    fetchAPI<{ success: boolean; message: string; ride: Ride }>(`/api/rides/${id}/confirm-delivery`, {
      method: 'POST',
    }, token),
}

// Messages API
export const messagesAPI = {
  getByRide: (rideId: string, params?: { page?: number; limit?: number }, token?: string) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<Message>>(`/api/messages/ride/${rideId}${query ? `?${query}` : ''}`, {}, token)
  },

  send: (rideId: string, senderId: string, content: string, token?: string) =>
    fetchAPI<Message>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ rideId, senderId, content }),
    }, token),

  markAsRead: (rideId: string, userId: string, token?: string) =>
    fetchAPI<{ success: boolean }>(`/api/messages/ride/${rideId}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ userId }),
    }, token),
}

// Users API
export const usersAPI = {
  get: (clerkId: string, token?: string) => fetchAPI<any>(`/api/users/${clerkId}`, {}, token),

  getDriver: (userId: string, token?: string) => fetchAPI<any>(`/api/users/driver/${userId}`, {}, token),

  updateDriverAvailability: (userId: string, isAvailable: boolean, token?: string) =>
    fetchAPI<any>(`/api/users/driver/${userId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    }, token),

  updateDriverLocation: (userId: string, coordinates: [number, number], token?: string) =>
    fetchAPI<any>(`/api/users/driver/${userId}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ coordinates }),
    }, token),

  // Get payment method status
  getPaymentMethod: (token?: string) =>
    fetchAPI<{ hasPaymentMethod: boolean; stripePaymentMethodId: string | null }>(
      '/api/users/me/payment-method',
      {},
      token
    ),

  // Save payment method to user profile
  savePaymentMethod: (stripePaymentMethodId: string, token?: string) =>
    fetchAPI<{ success: boolean; stripePaymentMethodId: string }>(
      '/api/users/payment-method',
      {
        method: 'POST',
        body: JSON.stringify({ stripePaymentMethodId }),
      },
      token
    ),
}

// Payments API
export const paymentsAPI = {
  createPaymentIntent: (rideId: string, amount: number, token?: string) =>
    fetchAPI<{ clientSecret: string; paymentIntentId: string }>(
      '/api/payments/create-intent',
      {
        method: 'POST',
        body: JSON.stringify({ rideId, amount }),
      },
      token
    ),

  confirmPayment: (rideId: string, paymentIntentId: string, token?: string) =>
    fetchAPI<{ success: boolean; paymentIntentId: string; status: string }>(
      '/api/payments/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ rideId, paymentIntentId }),
      },
      token
    ),

  savePaymentMethod: (rideId: string, stripePaymentMethodId: string, token?: string) =>
    fetchAPI<Ride>(`/api/rides/${rideId}/payment-method`, {
      method: 'POST',
      body: JSON.stringify({ stripePaymentMethodId }),
    }, token),

  // Stripe Connect
  createConnectAccount: (token?: string) =>
    fetchAPI<{ success: boolean; onboardingUrl: string }>(
      '/api/payments/create-connect-account',
      { method: 'POST' },
      token
    ),

  // Handle Stripe callback (if needed from frontend)
  handleStripeCallback: (token?: string) =>
    fetchAPI<{ success: boolean; stripeAccountId: string }>(
      '/api/payments/stripe-callback',
      {},
      token
    ),
}