# Especificación: Auditoría de Admin (H-42) + Cumplimiento GDPR (H-43)

**Fecha**: 2026-07-13
**Estado**: Aprobado para implementación
**Historias**: H-42 (Auditoría), H-43 (GDPR)

---

## 1. Resumen

Completar dos historias de usuario:

- **H-42**: Registro de auditoría consultable por admin — backend ya implementado (~73 llamadas audit), falta endpoint de consulta y UI en admin-frontend.
- **H-43**: Cumplimiento GDPR básico — consentimiento explícito, exportar datos personales, eliminar cuenta con anonimización.

---

## 2. Auditoría (H-42)

### 2.1 Backend: GET /api/admin/audit-logs

**Ruta**: Añadir a `backend/src/routes/admin.ts`

```
GET /api/admin/audit-logs
```

**Query params** (todos opcionales):

| Param | Tipo | Descripción |
|-------|------|-------------|
| `action` | string | Filtrar por acción exacta (ej: `admin.driver_approve`) |
| `userId` | string | Filtrar por clerkId del usuario |
| `entityType` | string | Filtrar por tipo de entidad (ride, user, driver, etc.) |
| `from` | ISO date | Fecha inicio (inclusive) |
| `to` | ISO date | Fecha fin (inclusive) |
| `page` | number | Página (default: 1) |
| `limit` | number | Items por página (default: 20, max: 50) |

**Middleware**: `authMiddleware`, `requireAdmin`

**Lógica**:
1. Construir filtro MongoDB dinámicamente con los params presentes
2. Si `from`/`to` presentes, filtrar por `metadata.timestamp` con `$gte`/`$lte`
3. Query con `.find(filter).sort({ 'metadata.timestamp': -1 }).skip().limit()`
4. Contar total con `.countDocuments(filter)`
5. Responder: `{ logs: AuditLog[], pagination: { page, limit, total, totalPages } }`

**Modelo usado**: `AuditLog` de `models/auditLog.ts`

### 2.2 Admin-Frontend: Página Auditoría

**Archivo nuevo**: `admin-frontend/src/pages/AuditLogs.tsx`

**Patrón a seguir**: `Disputes.tsx` (tabla + filtros + fila expandible + paginación)

**Componentes**:
- **Filter bar**: Fecha desde (input date) | Fecha hasta (input date) | Acción (dropdown/input) | Usuario (text input)
- **Tabla**: Timestamp | Usuario (clerkId) | Acción | Tipo Entidad | ID Entidad | Detalle
- **Fila expandible**: Al hacer clic en la fila, muestra detalles completos del log (JSON formateado del campo `details`)
- **Paginación**: Reutilizar patrón de `Disputes.tsx`

**Sidebar**: Añadir item "Auditoría" en `components/Layout.tsx`

**API** (`services/api.ts`):
```typescript
getAuditLogs(params: {
  action?: string, userId?: string, entityType?: string,
  from?: string, to?: string, page?: number, limit?: number
})
```

**Ruta**: `/audit-logs` en `App.tsx`

---

## 3. GDPR (H-43)

### 3.1 Backend: Modelo Consent

**Archivo nuevo**: `backend/src/models/consent.ts`

```typescript
const consentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },  // clerkId
  version: { type: String, required: true },               // "1.0"
  acceptedAt: { type: Date, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String },
});

export const Consent = mongoose.models.Consent || mongoose.model('Consent', consentSchema);
```

Índice: `{ userId: 1, acceptedAt: -1 }` para consultar última aceptación.

### 3.2 Backend: Rutas GDPR

**Archivo nuevo**: `backend/src/routes/gdpr.ts`

Tres endpoints protegidos con `authMiddleware`:

#### POST /api/gdpr/consent

- **Body**: `{ version: "1.0" }`
- **Lógica**: Crear registro Consent con userId del token Clerk + ipAddress + userAgent
- **Response**: `{ status: "ok", message: "Consentimiento registrado" }`

#### GET /api/gdpr/export

- **Lógica**: Reunir todos los datos del usuario autenticado:
  1. `User.findOne({ clerkId })` — perfil actual
  2. `Driver.findOne({ userId: clerkId })` — perfil de conductor (si existe)
  3. `Ride.find({ clientId: clerkId })` — rides como cliente
  4. `Ride.find({ driverId: clerkId })` — rides como conductor
  5. `Message.find({ senderId: clerkId })` — mensajes enviados
  6. `Rating.find({ raterId: clerkId })` — ratings dados
  7. `Rating.find({ ratedId: clerkId })` — ratings recibidos
  8. `Consent.find({ userId: clerkId }).sort({ acceptedAt: -1 })` — historial consentimiento
- **Response**: JSON object con todos los datos, header `Content-Type: application/json`
- **Nombre archivo**: `mis-datos-carglyn-{fecha}.json`

#### DELETE /api/gdpr/account

- **Lógica de anonimización**:

  1. **User**: `firstName = "Usuario eliminado"`, `lastName = null`, `email = md5(clerkId)@anon.local`, `imageUrl = null`, `isActive = false`, `phone = null`
  2. **Driver** (si existe): `vehicleImages = []`, `licenseImage = null`, `cedulaFront = null`, `cedulaBack = null`, `ruvDocument = null`, `plateImage = null`, `insurancePolicy = null`, carne docs = null, `phone = null`
  3. **Messages** donde `senderId = clerkId`: `content = "[mensaje eliminado por GDPR]"` — mantener metadatos (timestamps, rideId)
  4. **Ratings**: no se modifican (solo contienen valores numéricos + comentarios opcionales, y se necesitan para el sistema de reputación)
  5. **Audit logs**: anonimizar `userId` → hash del clerkId
  6. **Rides**: no se modifican (datos transaccionales requeridos para registros de negocio)
  7. **Notifications**: marcar como leídas, limpiar contenido
  8. **Consent**: se queda (es el registro de que hubo consentimiento antes de eliminar)

- **Log**: Registrar un audit log con `action: "gdpr.account_deleted"`, `userId: clerkId`
- **Response**: `{ status: "ok", message: "Cuenta eliminada exitosamente" }`
- **Nota**: Este endpoint no invalida la sesión de Clerk — el frontend debe redirigir al usuario y limpiar sesión local. Clerk no se ve afectado (la cuenta Clerk sigue existiendo, pero sin datos personales en MongoDB).

### 3.3 Backend: Montar rutas

En `backend/src/index.ts`:
```typescript
import gdprRoutes from './routes/gdpr'
app.route('/api/gdpr', gdprRoutes)
```

### 3.4 Frontend (cliente): Página de Privacidad

**Archivo nuevo**: `frontend/src/pages/Privacy.tsx`

- Ruta: `/privacy`
- Contenido: Política de privacidad estática con i18n (usando `useTranslation()`)
- Secciones: qué datos recopilamos, cómo los usamos, tus derechos GDPR, contacto
- Link en footer del Layout.tsx

### 3.5 Frontend (cliente): Página GDPR Settings

**Archivo nuevo**: `frontend/src/pages/GdprSettings.tsx`

- Ruta: `/settings/gdpr`
- Contenido:
  1. **Sección "Tu privacidad"** — breve explicación de tus derechos GDPR
  2. **Botón "Descargar mis datos"** → llama a `gdprAPI.exportData()`, descarga el JSON
  3. **Botón "Eliminar mi cuenta"** → modal de confirmación con SweetAlert2, luego `gdprAPI.deleteAccount()`, redirige a home, cierra sesión

### 3.6 Frontend (cliente): Consentimiento en primera visita

- **Archivo a modificar**: `frontend/src/App.tsx` o `frontend/src/components/Layout.tsx`
- **Flujo**:
  1. Después de autenticarse, verificar si el usuario ya tiene consentimiento registrado
  2. Si no → mostrar banner/modal al inicio: "Para cumplir con GDPR, acepta nuestra política de privacidad" con botones "Aceptar" y "Ver política"
  3. Al aceptar → `POST /api/gdpr/consent { version: "1.0" }`
  4. Guardar flag en localStorage para no mostrar cada vez que navega

- **API** (`frontend/src/services/api.ts`):
```typescript
const gdprAPI = {
  giveConsent: (version: string) => fetchAPI('/api/gdpr/consent', { method: 'POST', body: { version } }),
  exportData: () => fetchAPI<Blob>('/api/gdpr/export', { method: 'GET' }, true),  // blob response
  deleteAccount: () => fetchAPI('/api/gdpr/account', { method: 'DELETE' }),
}
```

### 3.7 Frontend (cliente): Rutas nuevas

En `App.tsx`:
```tsx
<Route path="privacy" element={<Privacy />} />
<Route path="settings/gdpr" element={<GdprSettings />} />
```

---

## 4. Resumen de archivos

### Modificar existentes:

| Archivo | Cambio |
|---------|--------|
| `backend/src/routes/admin.ts` | + `GET /admin/audit-logs` endpoint |
| `backend/src/index.ts` | + montar `gdprRoutes` en `/api/gdpr` |
| `admin-frontend/src/components/Layout.tsx` | + item "Auditoría" en sidebar |
| `admin-frontend/src/services/api.ts` | + `getAuditLogs()` |
| `admin-frontend/src/App.tsx` | + `/audit-logs` route |
| `frontend/src/services/api.ts` | + `gdprAPI` object |
| `frontend/src/components/Layout.tsx` | + links privacidad y settings en footer/header |
| `frontend/src/App.tsx` | + rutas `/privacy`, `/settings/gdpr` |

### Crear nuevos:

| Archivo | Propósito |
|---------|-----------|
| `backend/src/models/consent.ts` | Modelo Consentimiento GDPR |
| `backend/src/routes/gdpr.ts` | 3 endpoints GDPR |
| `admin-frontend/src/pages/AuditLogs.tsx` | Página de consulta de auditoría |
| `frontend/src/pages/Privacy.tsx` | Política de privacidad |
| `frontend/src/pages/GdprSettings.tsx` | Exportar/eliminar cuenta |

---

## 5. Dependencias

**Ninguna nueva dependencia.** Todo se implementa con:
- Mongoose (modelos + queries)
- Hono (rutas)
- React Router (frontend routing)
- SweetAlert2 (confirmación delete)
- Material Symbols (iconos)
- Fetch API + Blob download (export)

---

## 6. No incluido (futuro)

- Retención automática de datos (cron jobs para borrar logs antiguos)
- Webhook `user.deleted` de Clerk
- Portal de transparencia (qué datos tiene el sistema sobre ti)
- Anonimización completa de rides históricos
- Política de cookies
