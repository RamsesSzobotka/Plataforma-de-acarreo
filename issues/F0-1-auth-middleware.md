## Descripción

Implementar middleware de autenticación para validar la sesión/JWT de Clerk en todas las requests del backend.

### Backend (Requerido)
- Crear `backend/src/middleware/auth.ts`
- Validar token JWT de Clerk en headers Authorization
- Extraer `clerkId` del usuario autenticado
- Adjuntar usuario al contexto de Hono (c.get('user'))
- Manejar errores 401 (no autenticado), 403 (token inválido)

### Frontend (Referencia)
- SKILL: El frontend usa @clerk/clerk-react para autenticación
- Este endpoint backend habilita protección server-side

### Criterios de aceptación
- [ ] POST/PATCH/DELETE requests requieren token válido
- [ ] GET /api/auth/me retorna datos del usuario actual
- [ ] Errores 401/403 con mensaje claro

### Labels
`driver` `infra` `backend`