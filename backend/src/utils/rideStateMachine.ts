/**
 * Máquina de estados para validar transiciones válidas en rides
 * 
 * Diagrama:
 * requested → negotiating → accepted → in_progress → completed → paid
 *     ↓            ↓           ↓            ↓              ↓
 *  cancelled    cancelled   cancelled    cancelled      cancelled
 */

export type RideStatus = 'requested' | 'negotiating' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'cancelled'
export type UserRole = 'client' | 'driver' | 'admin'

interface TransitionRule {
  from: RideStatus
  to: RideStatus
  allowedRoles: UserRole[]
  description: string
}

// Reglas de transición válidas
const VALID_TRANSITIONS: TransitionRule[] = [
  // Cliente puede crear pedido → requested
  { from: 'requested', to: 'negotiating', allowedRoles: ['client', 'admin'], description: 'Cliente negocia' },
  { from: 'requested', to: 'cancelled', allowedRoles: ['client', 'admin'], description: 'Cliente cancela' },
  
  // En negociación
  { from: 'negotiating', to: 'accepted', allowedRoles: ['driver', 'admin'], description: 'Driver acepta' },
  { from: 'negotiating', to: 'cancelled', allowedRoles: ['client', 'admin'], description: 'Cliente cancela' },
  
  // Aceptado
  { from: 'accepted', to: 'in_progress', allowedRoles: ['driver', 'admin'], description: 'Driver confirma carga' },
  { from: 'accepted', to: 'cancelled', allowedRoles: ['driver', 'admin'], description: 'Driver cancela' },
  
  // En progreso
  { from: 'in_progress', to: 'completed', allowedRoles: ['driver', 'admin'], description: 'Driver confirma entrega' },
  { from: 'in_progress', to: 'cancelled', allowedRoles: ['admin'], description: 'Admin cancela (emergencia)' },
  
  // Completado (esperando pago)
  { from: 'completed', to: 'paid', allowedRoles: ['client', 'admin'], description: 'Cliente paga' },
  { from: 'completed', to: 'cancelled', allowedRoles: ['admin'], description: 'Admin cancela (emergencia)' },
  
  // Pagado (final)
  { from: 'paid', to: 'cancelled', allowedRoles: ['admin'], description: 'Admin cancela (reembolso)' },
]

/**
 * Validar si una transición es válida
 */
export function isValidTransition(
  currentStatus: RideStatus,
  newStatus: RideStatus,
  userRole: UserRole
): boolean {
  const rule = VALID_TRANSITIONS.find(t => t.from === currentStatus && t.to === newStatus)
  
  if (!rule) return false
  
  return rule.allowedRoles.includes(userRole)
}

/**
 * Obtener el motivo de rechazo de una transición
 */
export function getTransitionRejectionReason(
  currentStatus: RideStatus,
  newStatus: RideStatus,
  userRole: UserRole
): string {
  const rule = VALID_TRANSITIONS.find(t => t.from === currentStatus && t.to === newStatus)
  
  if (!rule) {
    return `No puedes ir de ${currentStatus} a ${newStatus}`
  }
  
  if (!rule.allowedRoles.includes(userRole)) {
    return `Solo ${rule.allowedRoles.join('/')} puede ${rule.description}`
  }
  
  return 'Transición no permitida'
}

/**
 * Obtener estados válidos a partir del estado actual
 */
export function getValidNextStates(
  currentStatus: RideStatus,
  userRole: UserRole
): RideStatus[] {
  return VALID_TRANSITIONS
    .filter(t => t.from === currentStatus && t.allowedRoles.includes(userRole))
    .map(t => t.to)
}

/**
 * Obtener descripción del cambio de estado
 */
export function getTransitionDescription(from: RideStatus, to: RideStatus): string {
  const rule = VALID_TRANSITIONS.find(t => t.from === from && t.to === to)
  return rule?.description || 'Cambio de estado'
}

/**
 * Validar si un ride está en estado "editable" (solo requested y negotiating)
 */
export function isRideEditable(status: RideStatus): boolean {
  return status === 'requested' || status === 'negotiating'
}

/**
 * Validar si un ride está en estado "cancelable"
 */
export function isRideCancelable(status: RideStatus, userRole: UserRole): boolean {
  return isValidTransition(status, 'cancelled', userRole)
}

/**
 * Obtener las reglas de transición para referencia
 */
export function getAllTransitionRules(): TransitionRule[] {
  return VALID_TRANSITIONS
}
