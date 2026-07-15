# H-51: Email en cambio de estado — Design Doc

## Resumen

Enviar emails a los participantes de un acarreo cuando el estado cambia: conductor asignado, viaje iniciado, pago recibido, cancelación. Configurable por usuario vía toggles en el perfil.

## Arquitectura

Helper centralizado `sendRideStatusEmail()` que:
1. Recibe `(ride, oldStatus, newStatus)`
2. Determina quién debe recibir email según `newStatus`
3. Verifica `emailPreferences` del usuario en MongoDB
4. Escoge y renderiza el template adecuado
5. Envía via Brevo REST API (fire-and-forget)

## Backend

### User Model — Nuevo campo

```typescript
// Add to backend/src/models/user.ts
emailPreferences: {
  onAccepted: { type: Boolean, default: true },
  onInProgress: { type: Boolean, default: true },
  onCompleted: { type: Boolean, default: true },
  onCancelled: { type: Boolean, default: true },
}
```

### Templates (backend/src/services/notifications/templates.ts)

| Template | Para | Asunto |
|----------|------|--------|
| `rideAcceptedEmail(to, ride)` | Cliente | "🚚 Conductor asignado a tu acarreo" |
| `rideInProgressEmail(to, ride)` | Cliente | "📍 Tu acarreo está en camino" |
| `rideCompletedPaidEmail(to, ride)` | Conductor | "✅ Pago recibido por acarreo" |
| `rideCancelledEmail(to, ride)` | Ambas partes | "❌ Acarreo cancelado" |

Todos siguen el mismo diseño visual (teal gradient header, info del ride, CTA button).

### Helper centralizado

Nuevo archivo: `backend/src/services/notifications/statusEmails.ts`

```typescript
async function sendRideStatusEmail(ride, oldStatus, newStatus)
  // 1. Determinar recipients según newStatus
  // 2. Para cada recipient, verificar emailPreferences[newStatus]
  // 3. Llamar template adecuado
  // 4. sendEmail() fire-and-forget
```

### Hooks existentes a modificar

| Endpoint | Cambio | Notificar a |
|----------|--------|-------------|
| `POST /:id/accept` | requested→accepted | Cliente |
| `POST /:id/start` | accepted→in_progress | Cliente |
| `POST /:id/confirm-delivery` | in_progress→paid | Conductor |
| `POST /:id/cancel` | varios→cancelled | La otra parte |
| `PATCH /:id/status` | cualquier | Según el nuevo estado |

### API — Preferencias de email

```
GET /api/users/me/email-preferences    → obtener preferencias actuales
PATCH /api/users/me/email-preferences  → actualizar preferencias
  Body: { onAccepted, onInProgress, onCompleted, onCancelled }
```

## Frontend

### Nueva página: EmailNotificationsSettings

- Ruta: `/settings/email-notifications` (protegida)
- 4 toggles on/off con labels descriptivos:
  - "Cuando un conductor acepte mi pedido"
  - "Cuando el viaje inicie"
  - "Cuando se complete y pague"  
  - "Cuando cancelen un acarreo"
- Botón "Guardar cambios"
- Diseño consistente con el sistema (teal accents, Material Symbols)

### Enlace desde el perfil

Agregar link en el menú de navegación o en el Layout a `/settings/email-notifications`.

## Flujo completo

```
Status change → Endpoint handler → sendRideStatusEmail()
  → getUserEmail(clerkId) → check emailPreferences
  → render template → sendEmail() via Brevo
```

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `backend/src/models/user.ts` | Add `emailPreferences` field |
| `backend/src/services/notifications/templates.ts` | Add 4 new templates |
| `backend/src/services/notifications/statusEmails.ts` | **NEW** Centralized helper |
| `backend/src/routes/rides.ts` | Hook helper into 5 endpoints |
| `backend/src/routes/users.ts` | Add email-preferences endpoints |
| `frontend/src/pages/EmailNotificationSettings.tsx` | **NEW** Settings page |
| `frontend/src/App.tsx` | Add route |
