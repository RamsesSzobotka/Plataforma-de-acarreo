# Issue F0-2: Role Middleware

## Descripción
Implementar middleware de validación de roles para verificar que el usuario tiene el rol requerido.

---

## 1. Ubicación de archivos

### Archivos a crear
```
backend/src/middleware/role.ts
backend/src/__tests__/role.test.ts
```

### Archivos a modificar
```
backend/src/index.ts
```

---

## 2. Herramientas y dependencias

### Ya instaladas
- `hono` v4.0.0
- `mongoose` v8.9.0
- Dependencias del proyecto

---

## 3. Implementación detallada

### 3.1. Middleware de roles

```typescript
// backend/src/middleware/role.ts
import { Context, Next } from 'hono'
import { authMiddleware, type AuthUser } from './auth'

/**
 * Tipos de roles válidos
 */
export type UserRole = 'client' | 'driver' | 'admin'

/**
 * Opciones de configuración del middleware
 */
export interface RoleMiddlewareOptions {
  roles: UserRole[]
  allowSelf?: boolean // Permitir que usuario acceda a sus propios recursos
}

/**
 * Middleware de validación de roles
 * @param roles - Array de roles permitidos
 * @param allowSelf - Si true, permite acceso a recursos propios sin importar rol
 */
export function requireRole(roles: UserRole[], allowSelf: boolean = false) {
  return async (c: Context, next: Next) => {
    // 1. Primero verificar que hay usuario autenticado
    const user = c.get('user') as AuthUser | null
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    // 2. Verificar que el rol del usuario está en la lista de roles permitidos
    if (!roles.includes(user.role)) {
      console.warn(`Role check failed: user ${user.clerkId} has role '${user.role}' but required one of [${roles.join(', ')}]`)
      return c.json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: user.role
      }, 403)
    }
    
    // 3. Si allowSelf, verificar que puede acceder a sus propios recursos
    // (Esto se maneja en la ruta específica, no aquí)
    
    await next()
  }
}

/**
 * Middleware específico para rutas de conductor/driver
 */
export function requireDriver() {
  return requireRole(['driver', 'admin'])
}

/**
 * Middleware específico para rutas de cliente
 */
export function requireClient() {
  return requireRole(['client', 'admin'])
}

/**
 * Middleware específico para rutas de admin
 */
export function requireAdmin() {
  return requireRole(['admin'])
}
```

### 3.2. Uso en rutas

```typescript
// backend/src/routes/rides.ts
import { requireDriver } from '../middleware/role'

// Ruta solo para drivers
rides.post('/', requireDriver(), async (c) => {
  // Solo drivers pueden crear rides (si es necesario)
})

// Ruta solo para drivers - aceptar pedido
rides.post('/:id/accept', requireDriver(), async (c) => {
  // Lógica para aceptar pedido
})
```

### 3.3. Tests

```typescript
// backend/src/__tests__/role.test.ts
import { describe, it, expect, beforeAll } from 'bun:test'

describe('Role Middleware', () => {
  
  it('should return 401 when no user in context', async () => {
    // Test sin usuario autenticado
  })
  
  it('should return 403 when user role does not match', async () => {
    // Test con usuario pero rol incorrecto
  })
  
  it('should allow when user role matches', async () => {
    // Test con usuario y rol correcto
  })
})

describe('requireDriver middleware', () => {
  
  it('should allow driver role', async () => {
    const user = { clerkId: 'driver_123', role: 'driver' }
    // Verificar que pasa
  })
  
  it('should reject client role', async () => {
    const user = { clerkId: 'client_123', role: 'client' }
    // Verificar que retorna 403
  })
})
```

---

## 4. Comandos

```bash
cd backend && bun test src/__tests__/role.test.ts
```

---

## 5. Criterios de aceptación

- [ ] Middleware en `backend/src/middleware/role.ts`
- [ ]Función `requireRole(roles)` exportada
- [ ] Funciones helper `requireDriver()`, `requireClient()`, `requireAdmin()`
- [ ] Retorna 403 cuando rol no coincide
- [ ] Tests covering casos positivos y negativos
- [ ] Integración con authMiddleware

---

## Labels
`Driver` `Auth` `backend`