const API_BASE = '/admin/api'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }
  return response.json()
}

export const api = {
  // Stats
  getStats: () => fetchApi<{ stats: any }>('/stats'),

  // Users
  getUsers: (params?: { role?: string; search?: string; page?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.role) searchParams.set('role', params.role)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.page) searchParams.set('page', String(params.page))
    return fetchApi<{ users: any[]; pagination: any }>(`/users?${searchParams}`)
  },
  getUser: (id: string) => fetchApi<any>(`/users/${id}`),
  updateUser: (id: string, data: any) => 
    fetchApi<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  toggleUserActive: (id: string) => 
    fetchApi<any>(`/users/toggle-active/${id}`, { method: 'POST' }),

  // Drivers
  getDrivers: (params?: { status?: string; page?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', String(params.page))
    return fetchApi<{ drivers: any[]; pagination: any }>(`/drivers?${searchParams}`)
  },
  getPendingDrivers: () => fetchApi<{ drivers: any[] }>('/drivers/pending'),
  getDriver: (userId: string) => fetchApi<any>(`/drivers/${userId}`),
  verifyDriver: (userId: string, action: 'approve' | 'reject', reason?: string) =>
    fetchApi<any>(`/drivers/verify/${userId}`, { 
      method: 'PATCH', 
      body: JSON.stringify({ action, reason }) 
    }),
  setDriverReviewing: (userId: string) =>
    fetchApi<any>(`/drivers/set-reviewing/${userId}`, { method: 'PATCH' }),
  suspendDriver: (userId: string) =>
    fetchApi<any>(`/drivers/suspend/${userId}`, { method: 'PATCH' }),

  // Rides
  getRides: (params?: { status?: string; page?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', String(params.page))
    return fetchApi<{ rides: any[]; pagination: any }>(`/rides?${searchParams}`)
  },
  getRide: (id: string) => fetchApi<any>(`/rides/${id}`),
  updateRide: (id: string, data: any) =>
    fetchApi<any>(`/rides/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancelRide: (id: string, reason: string) =>
    fetchApi<any>(`/rides/cancel/${id}`, { method: 'PATCH', body: JSON.stringify({ reason }) })
}