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
  getMonthlyReports: (months?: number) => {
    const query = months ? `?months=${months}` : ''
    return request(`/stats/reports/monthly${query}`)
  },

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
  unsuspendDriver: (userId: string) =>
    request(`/drivers/${userId}/unsuspend`, { method: 'POST' }),
  suspendClient: (clerkId: string, reason?: string) =>
    request(`/users/${clerkId}`, { method: 'PATCH', body: JSON.stringify({ isActive: false, reason }) }),
  updateDriver: (userId: string, data: any) =>
    request(`/drivers/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Rides
  getRides: (params?: { status?: string; page?: number; limit?: number; clientId?: string }) => {
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

  // Reports/Disputes
  getReports: (params?: { status?: string; category?: string; page?: number; limit?: number; search?: string }) => {
    const query = new URLSearchParams(params as any).toString()
    return request(`/reports${query ? `?${query}` : ''}`)
  },
  getReport: (id: string) => request(`/reports/${id}`),
  resolveReport: (id: string, data: { status?: string; resolution: string }) =>
    request(`/reports/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateReportStatus: (id: string, status: string) =>
    request(`/reports/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Refunds
  refundRide: (rideId: string, data: { reportId?: string; reason: string }) =>
    request(`/rides/${rideId}/refund`, { method: 'POST', body: JSON.stringify(data) }),

  // Pay driver
  payDriverRide: (rideId: string, data: { reportId?: string }) =>
    request(`/rides/${rideId}/pay-driver`, { method: 'POST', body: JSON.stringify(data) }),

  // Audit Logs
  getAuditLogs: async (params: {
    action?: string
    userId?: string
    entityType?: string
    from?: string
    to?: string
    page?: number
    limit?: number
  } = {}) => {
    const query = new URLSearchParams()
    if (params.action) query.set('action', params.action)
    if (params.userId) query.set('userId', params.userId)
    if (params.entityType) query.set('entityType', params.entityType)
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)
    if (params.page) query.set('page', params.page.toString())
    if (params.limit) query.set('limit', params.limit.toString())
    return request(`/audit-logs?${query.toString()}`)
  },
}