---
name: clerk-auth-patterns
description: >
  Patrones de integración Clerk + MongoDB para autenticación y sincronización de usuarios.
  Trigger: Cuando se implementa auth con Clerk, webhook de Clerk, o sincronización de usuarios.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Configurar webhook de Clerk para sincronizar usuarios con MongoDB
- Implementar middleware de autenticación en Hono
- Manejar roles (client, driver, admin) con metadata de Clerk
- Implementar SSO con Google, Microsoft, UTP

## Critical Patterns

### 1. Webhook de Clerk (Sincronización de Usuarios)

```typescript
// backend/src/routes/auth.ts
import { verifyWebhook } from '@clerk/clerk-sdk-node'

export async function handleClerkWebhook(c: Context) {
  // Verificar firma del webhook
  const payload = await c.req.text()
  const headers = c.req.headers()
  
  try {
    const event = verifyWebhook(payload, headers)
    
    switch (event.type) {
      case 'user.created':
        await syncUserToMongo(event.data)
        break
      case 'user.updated':
        await updateUserInMongo(event.data)
        break
      case 'user.deleted':
        await deleteUserFromMongo(event.data)
        break
    }
    
    return c.json({ received: true })
  } catch (err) {
    return c.json({ error: 'Webhook verification failed' }, 400)
  }
}
```

### 2. Sincronización con MongoDB

```typescript
// backend/src/services/user.service.ts
import { User } from '../models/user'

interface ClerkUser {
  id: string
  email_addresses: { email_address: string }[]
  first_name?: string
  last_name?: string
  image_url?: string
  public_metadata?: { role?: 'client' | 'driver' | 'admin' }
}

export async function syncUserToMongo(clerkUser: ClerkUser) {
  const email = clerkUser.email_addresses[0]?.email_address
  
  const user = await User.findOneAndUpdate(
    { clerkId: clerkUser.id },
    {
      clerkId: clerkUser.id,
      email,
      firstName: clerkUser.first_name,
      lastName: clerkUser.last_name,
      imageUrl: clerkUser.image_url,
      role: clerkUser.public_metadata?.role || 'client',
      isActive: true,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  )
  
  return user
}
```

### 3. Middleware de Autenticación

```typescript
// backend/src/middleware/auth.ts
import { verifyToken } from '@clerk/clerk-sdk-node'
import type { MiddlewareHandler } from 'hono'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.headers().get('Authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const token = authHeader.split(' ')[1]
  
  try {
    const session = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    })
    
    c.set('userId', session.sub)
    c.set('userRole', session.public_metadata?.role || 'client')
    
    await next()
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401)
  }
}
```

### 4. Verificación de Rol

```typescript
// backend/src/middleware/role.ts
import type { MiddlewareHandler } from 'hono'

type Role = 'client' | 'driver' | 'admin'

export const requireRole = (...allowedRoles: Role[]): MiddlewareHandler => {
  return async (c, next) => {
    const userRole = c.get('userRole') as Role
    
    if (!allowedRoles.includes(userRole)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    
    await next()
  }
}

// Uso:
// app.post('/rides', requireRole('client'), createRide)
```

### 5. Ownership Check (Anti-IDOR)

```typescript
// backend/src/middleware/ownership.ts
export function checkOwnership(getOwnerId: (resource: any) => string): MiddlewareHandler {
  return async (c, next) => {
    const resource = c.get('resource')
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    
    // Admin puede acceder a todo
    if (userRole === 'admin') {
      return await next()
    }
    
    // Verificar ownership
    if (resource && getOwnerId(resource) !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    
    await next()
  }
}
```

## Code Examples

### Frontend: Proteger rutas con Clerk

```typescript
// frontend/src/App.tsx
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <Routes>
        <Route path="/" element={<Home />} />
        
        {/* Rutas protegidas */}
        <Route element={<ProtectedRoute />}>
          <Route path="/create-ride" element={<CreateRide />} />
          <Route path="/my-rides" element={<MyRides />} />
        </Route>
      </Routes>
    </ClerkProvider>
  )
}
```

### Obtener usuario actual en frontend

```typescript
import { useUser } from '@clerk/clerk-react'

function MyComponent() {
  const { user, isSignedIn } = useUser()
  
  if (!isSignedIn) return <Navigate to="/" />
  
  const role = user.publicMetadata?.role || 'client'
  
  return <div>Hola {user.firstName}, eres {role}</div>
}
```

## Commands

```bash
# Configurar webhook de Clerk en desarrollo
clerk webhooks serve --port 3001

# Probar webhook localmente
curl -X POST http://localhost:3001/api/auth/webhook \
  -H "Content-Type: application/json" \
  -d @test-webhook-payload.json
```

## Resources

- **Templates**: Ver [assets/clerk-webhook-handler.ts](assets/clerk-webhook-handler.ts)
- **Documentación**: [Clerk SDK Node](https://clerk.com/docs/backend-requests/overview)