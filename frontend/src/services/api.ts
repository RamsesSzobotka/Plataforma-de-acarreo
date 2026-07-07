import type { Ride, Message, PaginatedResponse, RatingWithRater, AppNotification } from '../types'

const API_URL = import.meta.env.VITE_API_URL || ''

export class WebSocketService {
  private ws: WebSocket | null = null
  private rideId: string | null = null
  private token: string | null = null
  // Use array of callbacks to allow multiple listeners
  private messageCallbacks: Set<(data: any) => void> = new Set()
  private errorCallbacks: Set<(error: Event) => void> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private isIntentionallyDisconnected = false

  connect(rideId: string, token: string, pathPrefix = '/ws/chat/') {
    // Reset flag to allow reconnection (tracking uses this)
    this.isIntentionallyDisconnected = false

    // Already connected to this ride
    if (this.ws?.readyState === WebSocket.OPEN && this.rideId === rideId) {
      return
    }

    // Different ride - disconnect first
    if (this.ws && this.rideId !== rideId) {
      this.disconnectInternal()
    }

    this.rideId = rideId
    this.token = token
    const wsUrl = `${API_URL.replace('http', 'ws')}${pathPrefix}${rideId}`
    
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      // Send auth token after connection is open
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'auth', token }))
      }
      // Start heartbeat
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Notify all listeners
        this.messageCallbacks.forEach(callback => {
          try {
            callback(data)
          } catch (err) {
            console.error('Error in message callback:', err)
          }
        })
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.errorCallbacks.forEach(callback => {
        try {
          callback(error)
        } catch (err) {
          console.error('Error in error callback:', err)
        }
      })
    }

    this.ws.onclose = () => {
      this.stopHeartbeat()
      
      // Don't reconnect if intentionally disconnected
      if (this.isIntentionallyDisconnected) {
        return
      }

      // Attempt reconnection with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
        setTimeout(() => {
          if (this.rideId && this.token && !this.isIntentionallyDisconnected) {
            this.connect(this.rideId, this.token)
          }
        }, delay)
      }
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    // Send ping every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // Subscribe to messages - returns unsubscribe function
  onMessage(callback: (data: any) => void): () => void {
    this.messageCallbacks.add(callback)
    return () => {
      this.messageCallbacks.delete(callback)
    }
  }

  // Subscribe to errors - returns unsubscribe function
  onError(callback: (error: Event) => void): () => void {
    this.errorCallbacks.add(callback)
    return () => {
      this.errorCallbacks.delete(callback)
    }
  }

  // Internal disconnect without resetting intent flag
  private disconnectInternal() {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close(1000, 'Switching rides')
      this.ws = null
    }
  }

  disconnect() {
    this.isIntentionallyDisconnected = true
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close(1000, 'User left')
      this.ws = null
    }
    this.rideId = null
    this.token = null
  }

  reconnect(rideId: string, token: string) {
    this.isIntentionallyDisconnected = false
    this.connect(rideId, token)
  }

  // Get current connection state
  getState(): { isConnected: boolean; rideId: string | null } {
    return {
      isConnected: this.ws?.readyState === WebSocket.OPEN,
      rideId: this.rideId
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket not connected, cannot send:', data)
    }
  }
}

export const wsService = new WebSocketService()

/**
 * WebSocket Service for user-level notifications.
 * Connects to /ws/user and receives events like rating_updated.
 * This is a separate connection from ride-level chat/tracking WS.
 */
export class UserWebSocketService {
  private ws: WebSocket | null = null
  private token: string | null = null
  private messageCallbacks: Set<(data: any) => void> = new Set()
  private isConnected = false

  connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN && this.token === token) return
    
    this.disconnect()
    this.token = token
    
    const API_URL = import.meta.env.VITE_API_URL || ''
    const wsUrl = `${API_URL.replace('http', 'ws')}/ws/user`
    
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      // Send auth after connection
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'auth', token }))
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // auth_success means we're connected
        if (data.type === 'auth_success') {
          this.isConnected = true
          return
        }
        // Dispatch to callbacks
        this.messageCallbacks.forEach(cb => {
          try { cb(data) } catch (err) { console.error('Error in user WS callback:', err) }
        })
      } catch (err) {
        console.error('Error parsing user WS message:', err)
      }
    }

    this.ws.onclose = () => {
      this.isConnected = false
      // Auto-reconnect after 5s
      if (this.token) {
        setTimeout(() => {
          if (this.token) this.connect(this.token)
        }, 5000)
      }
    }

    this.ws.onerror = () => {
      // onclose will handle reconnect
    }
  }

  onMessage(callback: (data: any) => void): () => void {
    this.messageCallbacks.add(callback)
    return () => {
      this.messageCallbacks.delete(callback)
    }
  }

  disconnect() {
    this.isConnected = false
    this.token = null
    if (this.ws) {
      this.ws.close(1000, 'User left')
      this.ws = null
    }
  }

  getConnected(): boolean {
    return this.isConnected
  }
}

// Singleton instance
export const userWsService = new UserWebSocketService()

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

  // Obtener ubicación actual del conductor desde Redis (tracking)
  getDriverLocation: (id: string, token?: string) =>
    fetchAPI<{ data: { driverId: string; latitude: number; longitude: number; heading: number; speed: number; updatedAt: number } | null }>(
      `/api/rides/${id}/driver-location`,
      {},
      token
    ),
}

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

export const usersAPI = {
  get: (clerkId: string, token?: string) => fetchAPI<any>(`/api/users/${clerkId}`, {}, token),

  getDriver: (userId: string, token?: string) => fetchAPI<any>(`/api/users/driver/${userId}`, {}, token),

  updateDriverAvailability: (userId: string, isAvailable: boolean, token?: string) =>
    fetchAPI<any>(`/api/users/driver/${userId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    }, token),

  getPaymentMethod: (token?: string) =>
    fetchAPI<{
      hasPaymentMethod: boolean,
      stripePaymentMethodId: string | null,
      paymentMethodId?: string | null,
      last4?: string,
      brand?: string,
      expMonth?: number,
      expYear?: number,
    }>(
      '/api/users/me/payment-method',
      {},
      token
    ),

  savePaymentMethod: (stripePaymentMethodId: string, token?: string) =>
    fetchAPI<{ success: boolean; stripePaymentMethodId: string }>(
      '/api/users/payment-method',
      {
        method: 'POST',
        body: JSON.stringify({ stripePaymentMethodId }),
      },
      token
    ),

  deletePaymentMethod: (token?: string) =>
    fetchAPI<{ success: boolean }>(
      '/api/users/payment-method',
      { method: 'DELETE' },
      token
    ),
}

export const ratingsAPI = {
  getDriverRatings: (userId: string, params?: { page?: number; limit?: number }, token?: string) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<RatingWithRater>>(
      `/api/ratings/driver/${userId}${query ? `?${query}` : ''}`,
      {},
      token
    )
  },

  getClientRatings: (userId: string, params?: { page?: number; limit?: number }, token?: string) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<RatingWithRater>>(
      `/api/ratings/client/${userId}${query ? `?${query}` : ''}`,
      {},
      token
    )
  },

  getRideRatings: (rideId: string, token?: string) => {
    return fetchAPI<{ ratings: RatingWithRater[] }>(
      `/api/ratings/ride/${rideId}`,
      {},
      token
    )
  },
}

export const reportsAPI = {
  create: (data: { reportedId: string; reportedRole: string; rideId?: string; comment: string }, token?: string) =>
    fetchAPI<{ success: boolean; message: string; report: any }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),
}

export const notificationsAPI = {
  list: (params?: { page?: number; limit?: number }, token?: string) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<AppNotification>>(`/api/notifications${query ? `?${query}` : ''}`, {}, token)
  },

  unreadCount: (token?: string) =>
    fetchAPI<{ count: number }>('/api/notifications/unread-count', {}, token),

  markRead: (id: string, token?: string) =>
    fetchAPI<AppNotification>(`/api/notifications/${id}/read`, { method: 'PATCH' }, token),

  markAllRead: (token?: string) =>
    fetchAPI<{ success: boolean }>('/api/notifications/read-all', { method: 'PATCH' }, token),
}

export const paymentsAPI = {
  createSetupIntent: (token?: string) =>
    fetchAPI<{ clientSecret: string; setupIntentId: string; stripeCustomerId: string }>(
      '/api/payments/setup-intent',
      { method: 'POST' },
      token
    ),

  chargeRide: (rideId: string, token?: string) =>
    fetchAPI<{ success: boolean; paymentIntentId: string; status: string; clientSecret?: string; platformFee: number; driverAmount: number }>(
      '/api/payments/charge',
      {
        method: 'POST',
        body: JSON.stringify({ rideId }),
      },
      token
    ),

  createPaymentIntent: (rideId: string, amount: number, token?: string) =>
    fetchAPI<{ clientSecret: string; paymentIntentId: string; status?: string }>(
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

  createConnectAccount: (token?: string) =>
    fetchAPI<{ success: boolean; onboardingUrl: string; stripeAccountId?: string }>(
      '/api/payments/connect/create-account',
      { method: 'POST' },
      token
    ),

  getConnectStatus: (token?: string) =>
    fetchAPI<{ stripeAccountId: string | null; payoutsEnabled: boolean; chargesEnabled: boolean; detailsSubmitted: boolean }>(
      '/api/payments/connect/status',
      { method: 'GET' },
      token
    ),

  getPaymentHistory: (params?: { page?: number; limit?: number }, token?: string) =>
    fetchAPI<{
      data: Array<{
        _id: string
        title: string
        finalPrice: number
        driverAmount: number
        platformFee: number
        paidAt: string
        pickupLocation: { address: string }
        dropoffLocation: { address: string }
        createdAt: string
      }>
      summary: { totalEarnings: number; totalRides: number }
      pagination: { page: number; limit: number; total: number; pages: number }
    }>(
      `/api/payments/history?page=${params?.page || 1}&limit=${params?.limit || 20}`,
      { method: 'GET' },
      token
    ),

  handleStripeCallback: (token?: string) =>
    fetchAPI<{ success: boolean; message?: string; stripeAccountId?: string }>(
      '/api/payments/stripe-callback',
      {},
      token
    ),

  attachPaymentMethod: (paymentMethodId: string, setupIntentId: string, token?: string) =>
    fetchAPI<{ success: boolean; paymentMethodId: string; customerId: string; last4?: string; brand?: string }>(  
      '/api/payments/attach-payment-method',
      {
        method: 'POST',
        body: JSON.stringify({ paymentMethodId, setupIntentId }),
      },
      token
    ),
}