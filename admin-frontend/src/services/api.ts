// Usar ruta relativa para el proxy de Vite
const API_URL = '/api/admin'

function getAuthToken(): string | null {
  return localStorage.getItem('adminToken')
}

async function request(endpoint: string, options?: RequestInit) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getAuthToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (options?.headers) {
    const optsHeaders = options.headers as Record<string, string>
    Object.assign(headers, optsHeaders)
  }
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: options?.method,
    body: options?.body,
    headers,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error' }))
    throw new Error(error.error || 'Error')
  }
  return res.json()
}

export const api = {
  // Stats
  getStats: () => request('/stats'),
  getSystemStats: () => request('/stats/system'),
  getMonitoringMetrics: () => request('/stats/monitoring'),
  getRevenueStats: () => request('/stats/revenue'),

  // Users
  getUsers: (params?: { role?: string; page?: number }) => {
    const query = new URLSearchParams(params as any).toString()
    return request(`/users${query ? `?${query}` : ''}`)
  },
  getUser: (clerkId: string) => request(`/users/${clerkId}`),
  updateUser: (clerkId: string, data: any) =>
    request(`/users/${clerkId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (clerkId: string) =>
    request(`/users/${clerkId}`, { method: 'DELETE' }),

  // Drivers
  getDrivers: (params?: { status?: string; page?: number }) => {
    const query = new URLSearchParams(params as any).toString()
    return request(`/drivers${query ? `?${query}` : ''}`)
  },
  getDriver: (userId: string) => request(`/drivers/${userId}`),
  approveDriver: (userId: string) =>
    request(`/drivers/${userId}/approve`, { method: 'POST' }),
  rejectDriver: (userId: string, reason: string) =>
    request(`/drivers/${userId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reviewDriver: (userId: string) =>
    request(`/drivers/${userId}/review`, { method: 'POST' }),
  suspendDriver: (userId: string, reason?: string) =>
    request(`/drivers/${userId}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  updateDriver: (userId: string, data: any) =>
    request(`/drivers/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Rides
  getRides: (params?: { status?: string; page?: number }) => {
    const query = new URLSearchParams(params as any).toString()
    return request(`/rides${query ? `?${query}` : ''}`)
  },
  getRide: (id: string) => request(`/rides/${id}`),
  updateRide: (id: string, data: any) =>
    request(`/rides/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateRideStatus: (id: string, status: string) =>
    request(`/rides/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  assignDriver: (id: string, driverId: string) =>
    request(`/rides/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ driverId }) }),
  cancelRide: (id: string, reason?: string) =>
    request(`/rides/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  deleteRide: (id: string) =>
    request(`/rides/${id}`, { method: 'DELETE' }),
}