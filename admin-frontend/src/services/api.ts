// Usar ruta relativa para el proxy de Vite
const API_URL = '/api/admin'

function getAuthHeader() {
  const token = localStorage.getItem('adminToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options?.headers,
    },
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