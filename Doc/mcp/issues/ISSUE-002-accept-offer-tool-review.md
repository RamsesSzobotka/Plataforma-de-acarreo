# ISSUE-003: Revisión Tool 8 — `accept_offer` ✅ RESUELTA

> **Fecha**: 2026-06-19
> **Revisor**: Agente orquestador
> **Tool**: `accept_offer` (src/tools/accept-offer.ts)
> **Resuelto**: 2026-06-19
> **Severidad Global**: ❌ Crítica → ✅ Todos los issues corregidos

---

## RESUMEN GENERAL

La tool `accept_offer` tenía **3 issues críticos de diseño** que la hacían inutilizable para el caso de uso principal (cliente aceptando oferta de conductor), además de bugs en el backend. Todos los issues fueron corregidos en una sesión de reparación.

---

## LISTA DE ISSUES

### 🔴 ISSUE-1 (CRÍTICO) — Design Mismatch: tool del cliente llama endpoint de driver ✅ RESUELTO

| Campo | Valor |
|-------|-------|
| **Archivo** | `mcp-server/src/tools/accept-offer.ts:20` |
| **Descripción** | La tool está en la sección "Client-Side Tools", su descripción dice "Aceptar la oferta de un conductor", pero llama `POST /api/rides/:id/accept` que **requiere rol `driver` o `admin`**. Cualquier cliente que use esta tool recibirá un 403 FORBIDDEN. |
| **Solución** | Reescribir el handler para que llame `POST /api/messages/accept-price` en lugar de `POST /api/rides/:id/accept`. El endpoint `accept-price` permite al cliente aceptar la oferta de un conductor. |
| **Estado** | ✅ Handler reescrito. Ahora llama `POST /api/messages/accept-price` (no requiere rol driver). JSDoc agregado explicando la decisión. |

---

### 🔴 ISSUE-2 (CRÍTICO) — Race condition mal manejada en backend ✅ RESUELTO

| Campo | Valor |
|-------|-------|
| **Archivo** | `backend/src/routes/rides.ts:333-342` y `backend/src/routes/messages.ts:276-280` |
| **Descripción** | `findByIdAndUpdate(id, {...}, {new: true})` NO incluye `status: 'requested'` en el filtro de búsqueda. Esto significa que si dos llaman al endpoint casi simultáneamente, **ambos `findByIdAndUpdate` tendrán éxito** — el segundo pisará al primero, y ambos recibirán 200 OK pensando que aceptaron el ride. |
| **Solución** | Cambiar el filtro a `{ _id: id, status: 'requested' }` y usar `$set` para atomicidad. |
| **Estado** | ✅ Corregido en ambos endpoints (`rides.ts` y `messages.ts`). Ahora usan `{ _id: id, status: 'requested' }` + `$set`. |

---

### 🔴 ISSUE-3 (CRÍTICO) — `finalPrice` nunca se asigna al aceptar ✅ RESUELTO

| Campo | Valor |
|-------|-------|
| **Archivo** | `backend/src/routes/rides.ts:333-342` |
| **Descripción** | El backend recibe `agreedPrice` del body y lo valida, pero **nunca lo usa en el `findByIdAndUpdate`**. `finalPrice` queda como `undefined` en el documento. |
| **Solución** | Agregar `finalPrice: agreedPrice` al update, o `$set: { finalPrice: agreedPrice }`. |
| **Estado** | ✅ `finalPrice: agreedPrice` agregado al `$set` en `rides.ts`, y `finalPrice: contact.proposedPrice` en `messages.ts`. |

---

### ⚠️ ISSUE-4 (ALTA) — `agreedPrice` opcional en MCP pero obligatorio en backend ✅ RESUELTO

| Archivo | Descripción | Solución | Estado |
|---------|-------------|----------|--------|
| `mcp-server/src/schemas.ts:96` | Schema Zod marca `agreedPrice` como opcional, pero backend lo requiere. La lógica de fallback **nunca se implementó**. | Se migró a `accept-price`, ese endpoint ya usa `contact.proposedPrice`, resolviendo el issue automáticamente. | ✅ Ya no se envía `agreedPrice` al backend — se obtiene de `DriverContact.proposedPrice` |

### ⚠️ ISSUE-5 (MEDIA) — `_id` transformation frágil ✅ RESUELTO

| Archivo | Descripción | Solución | Estado |
|---------|-------------|----------|--------|
| `mcp-server/src/tools/accept-offer.ts:27` | `response._id?.toString() ?? response.id` — si ambos son `undefined`, el ride tendrá `id: undefined` silenciosamente. | Usar `String(response._id)` o validar que `_id` exista. | ✅ Ahora usa `String(rideData._id)` |

### ⚠️ ISSUE-6 (MEDIA) — Endpoint alternativo no documentado en código ✅ RESUELTO

| Archivo | Descripción | Solución | Estado |
|---------|-------------|----------|--------|
| `mcp-server/src/tools/accept-offer.ts:1-56` | Handler no menciona que existe `POST /api/messages/accept-price` como alternativa. | Agregar JSDoc explicando por qué se eligió este endpoint. | ✅ JSDoc completo agregado al handler |

### 🔵 ISSUE-7 (BAJA) — `chatEnabled` no se fuerza a `true` ✅ RESUELTO

| Archivo | Descripción | Solución | Estado |
|---------|-------------|----------|--------|
| `mcp-server/src/tools/accept-offer.ts:44` | Usa `?? false` pero la doc dice que debe ser `true` al aceptar. | Cambiar a `chatEnabled: true` tras accept exitoso. | ✅ `chatEnabled: true` forzado en el MCP handler y en ambos endpoints del backend |

---

## VEREDICTO FINAL

✅ **Todos los issues corregidos — herramienta funcional**

| Aspecto | Estado |
|---------|--------|
| Handler existe y registrado | ✅ Sí |
| Schema Zod completo | ✅ Sí |
| AuthToken extraído y pasado | ✅ Sí |
| Transformación `_id` → `id` | ✅ `String(rideData._id)` |
| Race condition handling | ✅ Filtro `status: 'requested'` + `$set` |
| `finalPrice` asignado | ✅ Se asigna en ambos endpoints |
| Cliente puede usar la tool | ✅ Usa `POST /api/messages/accept-price` (rol client) |
| Fallback si no hay `agreedPrice` | ✅ `contact.proposedPrice` de `DriverContact` |
| `chatEnabled` forzado | ✅ `true` después de aceptar |
| TypeScript compila | ✅ `tsc --noEmit` sin errores |

### Resumen de correcciones aplicadas

| # | Issue | Severidad | Fix aplicado |
|---|-------|-----------|-------------|
| 1 | Design mismatch (cliente → endpoint driver) | 🔴 | Handler usa `POST /api/messages/accept-price` |
| 2 | Race condition en backend | 🔴 | Filtro `{ _id, status: 'requested' }` + `$set` en ambos endpoints |
| 3 | `finalPrice` no asignado | 🔴 | Agregado al `$set` |
| 4 | `agreedPrice` inconsistente | ⚠️ | Backend obtiene de `DriverContact.proposedPrice` |
| 5 | `_id` transformation frágil | ⚠️ | `String(rideData._id)` |
| 6 | Endpoint no documentado | ⚠️ | JSDoc completo con explicación |
| 7 | `chatEnabled` no forzado | 🔵 | `true` en handler + ambos endpoints |

### Ficheros modificados

| Archivo | Cambio |
|---------|--------|
| `mcp-server/src/tools/accept-offer.ts` | Handler reescrito — endpoint cambiado, JSDoc, `String(_id)`, `chatEnabled: true` |
| `backend/src/routes/rides.ts:333-342` | `findByIdAndUpdate` con filtro status + `$set` + `finalPrice` + `chatEnabled` |
| `backend/src/routes/messages.ts:276-280` | `findByIdAndUpdate` con filtro status + `$set` + `finalPrice` + `chatEnabled` |

La solución completa migró el handler a `POST /api/messages/accept-price` y corrigió el backend para atomicidad y precio correcto.
