import { Hono } from 'hono/tiny'
import { Ride } from '../models/ride'
import { User } from '../models/user'

/**
 * Middleware para validar que el usuario es propietario de un ride
 * El usuario puede ser:
 * - Cliente (clientId)
 * - Driver asignado (driverId)
 * - Admin (siempre tiene acceso)
 */
export async function checkRideOwnership() {
  return async (c, next) => {
    try {
      const user = c.get('user')
      
      if (!user) {
        return c.json({ error: 'No autorizado' }, 401)
      }
      
      // Admin tiene acceso total
      if (user.role === 'admin') {
        return next()
      }
      
      const rideId = c.req.param('id')
      
      if (!rideId) {
        return c.json({ error: 'ID del ride no proporcionado' }, 400)
      }
      
      const ride = await Ride.findById(rideId)
      
      if (!ride) {
        return c.json({ error: 'Ride no encontrado' }, 404)
      }
      
      // Cliente o driver del ride pueden acceder
      const isClientOrDriver = 
        ride.clientId === user.clerkId || 
        ride.driverId === user.clerkId
      
      if (!isClientOrDriver) {
        return c.json({ error: 'No tienes permiso para acceder a este ride' }, 403)
      }
      
      // Guardar el ride en contexto para que las rutas puedan usarlo
      c.set('ride', ride)
      
      return next()
    } catch (err) {
      console.error('Error en checkRideOwnership:', err)
      return c.json({ error: 'Error verificando permisos' }, 500)
    }
  }
}

/**
 * Middleware para validar que el usuario es propietario de un usuario (perfil)
 */
export async function checkUserOwnership() {
  return async (c, next) => {
    try {
      const user = c.get('user')
      
      if (!user) {
        return c.json({ error: 'No autorizado' }, 401)
      }
      
      // Admin tiene acceso total
      if (user.role === 'admin') {
        return next()
      }
      
      const targetClerkId = c.req.param('clerkId') || c.req.param('userId')
      
      if (!targetClerkId) {
        return c.json({ error: 'ID del usuario no proporcionado' }, 400)
      }
      
      // El usuario solo puede ver/editar su propio perfil
      if (user.clerkId !== targetClerkId) {
        return c.json({ error: 'No tienes permiso para acceder a este perfil' }, 403)
      }
      
      return next()
    } catch (err) {
      console.error('Error en checkUserOwnership:', err)
      return c.json({ error: 'Error verificando permisos' }, 500)
    }
  }
}

/**
 * Middleware para validar que solo el cliente puede editar/cancelar
 */
export async function checkClientOwnership() {
  return async (c, next) => {
    try {
      const user = c.get('user')
      
      if (!user) {
        return c.json({ error: 'No autorizado' }, 401)
      }
      
      // Admin tiene acceso total
      if (user.role === 'admin') {
        return next()
      }
      
      const ride = c.get('ride')
      
      if (!ride) {
        return c.json({ error: 'Ride no encontrado en contexto' }, 500)
      }
      
      // Solo el cliente propietario puede realizar esta acción
      if (ride.clientId !== user.clerkId) {
        return c.json({ error: 'Solo el cliente puede realizar esta acción' }, 403)
      }
      
      return next()
    } catch (err) {
      console.error('Error en checkClientOwnership:', err)
      return c.json({ error: 'Error verificando permisos' }, 500)
    }
  }
}

/**
 * Middleware para validar que solo el driver puede realizar ciertas acciones
 */
export async function checkDriverOwnership() {
  return async (c, next) => {
    try {
      const user = c.get('user')
      
      if (!user) {
        return c.json({ error: 'No autorizado' }, 401)
      }
      
      // Admin tiene acceso total
      if (user.role === 'admin') {
        return next()
      }
      
      const ride = c.get('ride')
      
      if (!ride) {
        return c.json({ error: 'Ride no encontrado en contexto' }, 500)
      }
      
      // Solo el driver asignado puede realizar esta acción
      if (ride.driverId !== user.clerkId) {
        return c.json({ error: 'Solo el driver asignado puede realizar esta acción' }, 403)
      }
      
      return next()
    } catch (err) {
      console.error('Error en checkDriverOwnership:', err)
      return c.json({ error: 'Error verificando permisos' }, 500)
    }
  }
}
