import type { Ride, Message, PaginatedResponse } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || 'Request failed')
  }

  return response.json()
}

// Rides API
export const ridesAPI = {
  list: (params?: { status?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<Ride>>(`/api/rides${query ? `?${query}` : ''}`)
  },

  get: (id: string) => fetchAPI<Ride>(`/api/rides/${id}`),

  create: (data: Partial<Ride>) =>
    fetchAPI<Ride>('/api/rides', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Ride>) =>
    fetchAPI<Ride>(`/api/rides/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateStatus: (id: string, status: string, reason?: string) =>
    fetchAPI<Ride>(`/api/rides/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),

  accept: (id: string, driverId: string, agreedPrice: number) =>
    fetchAPI<Ride>(`/api/rides/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ driverId, agreedPrice }),
    }),

  cancel: (id: string, reason: string) =>
    fetchAPI<Ride>(`/api/rides/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
}

// Messages API
export const messagesAPI = {
  getByRide: (rideId: string, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<Message>>(`/api/messages/ride/${rideId}${query ? `?${query}` : ''}`)
  },

  send: (rideId: string, senderId: string, content: string) =>
    fetchAPI<Message>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ rideId, senderId, content }),
    }),

  markAsRead: (rideId: string, userId: string) =>
    fetchAPI<{ success: boolean }>(`/api/messages/ride/${rideId}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ userId }),
    }),
}

// Users API
export const usersAPI = {
  getDriver: (userId: string) => fetchAPI<any>(`/api/users/driver/${userId}`),

  updateDriverAvailability: (userId: string, isAvailable: boolean) =>
    fetchAPI<any>(`/api/users/driver/${userId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    }),

  updateDriverLocation: (userId: string, coordinates: [number, number]) =>
    fetchAPI<any>(`/api/users/driver/${userId}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ coordinates }),
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

  savePaymentMethod: (rideId: string, stripePaymentMethodId: string) =>
    fetchAPI<Ride>(`/api/rides/${rideId}/payment-method`, {
      method: 'POST',
      body: JSON.stringify({ stripePaymentMethodId }),
    }),
}