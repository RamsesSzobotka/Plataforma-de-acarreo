# Issue F0-1: Auth Middleware con Clerk

## Descripción
Implementar middleware de autenticación para validar JWT de Clerk en requests del backend.

---

## 1. Ubicación de archivos

### Archivos a crear
```
backend/src/middleware/auth.ts
backend/src/__tests__/auth.test.ts
```

### Archivos a modificar
```
backend/src/index.ts
backend/src/routes/auth.ts
.env
```

---

## 2. Herramientas y dependencias

### Ya instaladas
- `hono` v4.0.0
- `@clerk/clerk-sdk-node` v5.0.0
- `mongoose` v8.9.0

### Variables requeridas
```env
CLERK_SECRET_KEY=sk_test_xxxxx
```

---

## 3. Implementación

### Middleware auth.ts

```typescript
import { createClerkClient } from '@clerk/clerk-sdk-node'
import { Context, Next } from 'hono'
import { db } from '../db/mongo'

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})

export interface AuthUser {
  clerkId: string
  role: 'client' | 'driver' | 'admin'
  email: string
  firstName?: string
  lastName?: string
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader) {
    return c.json({ error: 'Authorization header required' }, 401)
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Invalid authorization format' }, 401)
  }
  
  const token = authHeader.slice(7)
  
  try {
    const claims = await clerkClient.verifyToken(token)
    const clerkId = claims.sub
    
    const usersCollection = db.collection('users')
    const user = await usersCollection.findOne({ clerkId })
    
    if (!user) {
      return c.json({ error: 'User not registered' }, 401)
    }
    
    c.set('user', {
      clerkId: user.clerkId,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    })
    
    await next()
  } catch (error) {
    return c.json({ error: 'Invalid or expired token' }, 403)
  }
}
```

### Registrar en index.ts
```typescript
app.use('/api/rides/*', authMiddleware)
app.use('/api/users/*', authMiddleware)
```

---

## 4. Tests

```typescript
describe('Auth Middleware', () => {
  it('should return 401 without token', async () => {
    const res = await app.request('/api/rides')
    expect(res.status).toBe(401)
  })
  
  it('should reject invalid token', async () => {
    const res = await app.request('/api/rides', {
      headers: { 'Authorization': 'Bearer invalid' }
    })
    expect(res.status).toBe(403)
  })
})
```

---

## 5. Criterios de aceptación

- [ ] Middleware en backend/src/middleware/auth.ts
- [ ] Función exportada authMiddleware
- [ ] 401 sin token, 403 con token inválido
- [ ] usuario adjuntado al contexto con c.get('user')
- [ ] Tests en __tests__/auth.test.ts

### Labels
`Driver` `Auth` `backend`