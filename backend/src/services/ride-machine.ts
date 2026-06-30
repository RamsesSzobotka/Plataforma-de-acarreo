export type TransitionResult = {
  allowed: boolean
  reason?: string
}

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  'requested': ['negotiating', 'accepted', 'cancelled'],
  'negotiating': ['requested', 'accepted', 'cancelled'],
  'accepted': ['in_progress', 'cancelled'],
  'in_progress': ['completed'],
  'completed': ['paid', 'failed'],
  'paid': [],
  'failed': ['requested'],
  'cancelled': [],
}

export const TRANSITION_ROLES: Record<string, { from: string; to: string; allowedRoles: string[] }[]> = {
  'requested->negotiating': [{ from: 'requested', to: 'negotiating', allowedRoles: ['client', 'driver', 'admin'] }],
  'requested->accepted': [{ from: 'requested', to: 'accepted', allowedRoles: ['driver', 'admin'] }],
  'requested->cancelled': [{ from: 'requested', to: 'cancelled', allowedRoles: ['client', 'admin'] }],
  'negotiating->requested': [{ from: 'negotiating', to: 'requested', allowedRoles: ['client', 'admin'] }],
  'negotiating->accepted': [{ from: 'negotiating', to: 'accepted', allowedRoles: ['driver', 'admin'] }],
  'negotiating->cancelled': [{ from: 'negotiating', to: 'cancelled', allowedRoles: ['client', 'admin'] }],
  'accepted->in_progress': [{ from: 'accepted', to: 'in_progress', allowedRoles: ['driver', 'admin'] }],
  'accepted->cancelled': [{ from: 'accepted', to: 'cancelled', allowedRoles: ['driver', 'admin'] }],
  'in_progress->completed': [{ from: 'in_progress', to: 'completed', allowedRoles: ['client', 'admin'] }],
  'completed->paid': [{ from: 'completed', to: 'paid', allowedRoles: ['system', 'client', 'admin'] }],
  'completed->failed': [{ from: 'completed', to: 'failed', allowedRoles: ['system', 'admin'] }],
  'failed->requested': [{ from: 'failed', to: 'requested', allowedRoles: ['client', 'admin'] }],
}

export function canTransition(from: string, to: string, role: string): TransitionResult {
  if (to === 'cancelled' && role === 'admin') {
    return { allowed: true }
  }

  const validTargets = ALLOWED_TRANSITIONS[from]
  if (!validTargets) {
    return { allowed: false, reason: `Estado '${from}' no es válido` }
  }

  if (!validTargets.includes(to)) {
    return { allowed: false, reason: `No se puede transicionar de '${from}' a '${to}'` }
  }

  const transitionKey = `${from}->${to}`
  const roleRules = TRANSITION_ROLES[transitionKey]
  if (roleRules) {
    const hasRole = roleRules.some(r => r.allowedRoles.includes(role))
    if (!hasRole) {
      return { allowed: false, reason: `Rol '${role}' no tiene permiso para esta transición` }
    }
  }

  return { allowed: true }
}

export function canCancel(status: string, role: string): TransitionResult {
  if (role === 'admin') return { allowed: true }
  
  switch (status) {
    case 'requested':
      return role === 'client'
        ? { allowed: true }
        : { allowed: false, reason: 'Solo el cliente puede cancelar un pedido en estado solicitado' }
    case 'negotiating':
      return role === 'client'
        ? { allowed: true }
        : { allowed: false, reason: 'Solo el cliente puede cancelar un pedido en negociación' }
    case 'accepted':
      return role === 'driver'
        ? { allowed: true }
        : { allowed: false, reason: 'Solo el conductor puede cancelar un pedido aceptado' }
    case 'in_progress':
    case 'completed':
    case 'paid':
    case 'failed':
      return { allowed: false, reason: `No se puede cancelar un pedido en estado '${status}'. Contacta al administrador.` }
    default:
      return { allowed: false, reason: `Estado '${status}' no válido para cancelación` }
  }
}
