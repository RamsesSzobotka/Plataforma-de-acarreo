# ASIGNACION.md — OBSOLETO
Ver: MCP-STADO.md para el estado actual.
Este documento refleja el estado PRE-Fase 4-11.

---

# Asignación de Responsabilidades — MCP Server

> **Proyecto**: Plataforma de Acarreos — MCP Server
> **Fecha**: 2026-06-22

---

## Distribución de Tools (8 + 7 = 15)

### Lógica de División

Para evitar conflictos y dependencias cruzadas, las tools se dividen por **rol del usuario final**:

| Desarrollador | Perfil | Tools |
|---------------|--------|-------|
| **Ramses Szobotka** | 🧑‍💼 **Cliente-side** | Las que usan clientes para publicar y gestionar acarreos |
| **Justin Barrios** | 🚚 **Conductor-side** | Las que usan conductores para encontrar y gestionar acarreos |

Ninguna tool de un desarrollador depende de una tool del otro para funcionar o probarse de forma aislada.

---

### 🧑‍💼 Ramses Szobotka — 8 Tools (Cliente)

| # | Tool | Archivo | Estado |
|---|------|---------|--------|
| 1 | `list_my_rides` | `src/mcp/tools/client/list-my-rides.ts` | ✅ Implementado |
| 2 | `create_ride` | `src/mcp/tools/client/create-ride.ts` | ✅ Implementado |
| 3 | `get_ride_details` | `src/mcp/tools/client/get-ride-details.ts` | ✅ Implementado |
| 4 | `view_offers` | `src/mcp/tools/client/view-offers.ts` | ✅ Implementado |
| 5 | `accept_offer` | `src/mcp/tools/client/accept-offer.ts` | ✅ Implementado |
| 6 | `confirm_delivery` | `src/mcp/tools/client/confirm-delivery.ts` | ⏳ Pendiente |
| 7 | `cancel_ride` | `src/mcp/tools/client/cancel-ride.ts` | ⏳ Pendiente |
| 8 | `rate_service` | `src/mcp/tools/client/rate-service.ts` | ⏳ Pendiente |

**Responsabilidades**:
- Implementar Tools 1–5 (ya implementadas en `backend/src/mcp/tools/client/`)
- Implementar Tool 6 `confirm_delivery`
- Implementar Tool 7 `cancel_ride`
- Implementar Tool 8 `rate_service`
- Registrar las tools en `backend/src/mcp/server.ts` al completarlas

**Endpoints backend requeridos**:
- `POST /api/rides/:id/confirm-delivery` — para Tool 6 (✅ Existente)
- `POST /api/rides/:id/cancel` — para Tool 7 (✅ Existente)
- `POST /api/rides/:id/rate` — para Tool 8 (✅ Existente)

---

### 🚚 Justin Barrios — 7 Tools (Conductor)

| # | Tool | Archivo | Estado |
|---|------|---------|--------|
| 1 | `list_available_rides` | `src/mcp/tools/driver/list-available-rides.ts` | ⏳ Pendiente |
| 2 | `send_message` | `src/mcp/tools/driver/send-message.ts` | ⏳ Pendiente |
| 3 | `propose_price` | `src/mcp/tools/driver/propose-price.ts` | ⏳ Pendiente |
| 4 | `start_trip` | `src/mcp/tools/driver/start-trip.ts` | ⏳ Pendiente |
| 5 | `upload_delivery_photo` | `src/mcp/tools/driver/upload-delivery-photo.ts` | ⏳ Pendiente |
| 6 | `get_payment_history` | `src/mcp/tools/driver/get-payment-history.ts` | ⏳ Pendiente |
| 7 | `get_driver_profile` | `src/mcp/tools/driver/get-driver-profile.ts` | ⏳ Pendiente |

**Responsabilidades**:
- Implementar Tool 1 `list_available_rides` (pedidos cercanos con geolocalización)
- Implementar Tool 2 `send_message` (enviar mensaje en chat del ride)
- Implementar Tool 3 `propose_price` (proponer precio al cliente, máx 3 propuestas)
- Implementar Tool 4 `start_trip` (iniciar viaje, cambia a `in_progress`)
- Implementar Tool 5 `upload_delivery_photo` (subir foto de entrega)
- Implementar Tool 6 `get_payment_history` (historial de pagos y ganancias)
- Implementar Tool 7 `get_driver_profile` (perfil completo del conductor)
- Registrar las 7 tools en `backend/src/mcp/server.ts` al completarlas

**Endpoints backend requeridos**:
- `GET /api/rides/available` — para Tool 1 (✅ Existente)
- `POST /api/messages` — para Tool 2 (✅ Existente)
- `POST /api/messages/propose-price` — para Tool 3 (✅ Existente)
- `POST /api/rides/:id/start` — para Tool 4 (✅ Existente)
- `POST /api/rides/:id/delivery-photo` — para Tool 5 (✅ Existente)
- `GET /api/rides?driverId={id}&status=paid` — para Tool 6 (✅ Existente)
- `GET /api/users/driver/:userId` — para Tool 7 (✅ Existente)

---

## Dependencias Compartidas

### Ambos desarrolladores deben respetar

| Archivo | Propósito | Regla |
|---------|-----------|-------|
| `src/mcp/types.ts` | Interfaces compartidas | No modificar sin coordinación |
| `src/mcp/schemas.ts` | Schemas Zod de validación | Agregar schemas nuevos al final, no modificar existentes |
| `src/mcp/errors.ts` | Clases de error | No modificar |
| `src/mcp/tools/index.ts` | Registro de tools | No modificar (es el contrato) |
| `src/mcp/server.ts` | Servidor MCP | Modificar para registrar nuevas tools |

### Pasos al completar cada tool

1. Crear el archivo handler en `src/mcp/tools/<rol>/<tool-name>.ts`
2. Importar el handler en `src/mcp/server.ts`
3. Agregar `register(...)` en `registerAllTools()`
4. Implementar **role check**: verificar que el usuario tiene el rol requerido
5. Implementar **ownership check**: verificar que el usuario es dueño del recurso (cuando aplica)
6. Implementar **state check**: verificar que el ride está en el estado correcto (cuando aplica)
7. Ejecutar `bun run typecheck` para verificar compilación
8. Ejecutar `bun run src/index.ts` para probar que el servidor inicia

---

## Matriz de Permisos por Tool

Cada tool requiere ciertos roles y verifica ownership del recurso. Los desarrolladores deben implementar estas validaciones en cada handler. El rol se obtiene consultando la base de datos (`users.findOne({ clerkId })`) en cada llamada, no del token MCP.

**Regla general**: Las tools de cliente están disponibles para `client` y `driver` (un conductor también puede publicar acarreos). Las tools de conductor son solo para `driver`.

### 🧑‍💼 Ramses Szobotka — Tools de Cliente

| # | Tool | Roles Permitidos | Ownership | Restricción de Estado | Implementado |
|---|------|------------------|-----------|----------------------|--------------|
| 1 | `list_my_rides` | `client` / `driver` | `clientId = userId` | — | ✅ |
| 2 | `create_ride` | `client` / `driver` | Asignado automático (`clientId = userId`) | — | ✅ |
| 3 | `get_ride_details` | `client` / `driver` | `clientId = userId` OR `driverId = userId` | — | ❌ Sin ownership check |
| 4 | `view_offers` | `client` / `driver` | `ride.clientId = userId` | Solo rides propias | ❌ Sin ownership check |
| 5 | `accept_offer` | `client` / `driver` | `ride.clientId = userId` | `status = 'requested'` | ✅ |
| 6 | `confirm_delivery` | `client` / `driver` | `ride.clientId = userId` | `status = 'completed'` | ⏳ Pendiente |
| 7 | `cancel_ride` | `client` / `driver` | `ride.clientId = userId` | `status = 'requested' \| 'negotiating'` | ⏳ Pendiente |
| 8 | `rate_service` | `client` / `driver` | Debe ser partícipe del ride | `status = 'paid'` | ⏳ Pendiente |

> **Regla:** Las tools de cliente pueden ser usadas tanto por `client` como por `driver`. Un conductor también puede publicar y gestionar acarreos como cliente.

### 🚚 Justin Barrios — Tools de Conductor

| # | Tool | Roles Permitidos | Ownership | Restricción de Estado | Implementado |
|---|------|------------------|-----------|----------------------|--------------|
| 1 | `list_available_rides` | `driver` solo | — (ve rides sin asignar) | `status = 'requested'` | ⏳ Pendiente |
| 2 | `send_message` | `client` / `driver` | Debe tener contacto activo en el ride | `chatEnabled = true` | ⏳ Pendiente |
| 3 | `propose_price` | `driver` solo | Debe haber contacto activo como driver | `status = 'requested' \| 'negotiating'` | ⏳ Pendiente |
| 4 | `start_trip` | `driver` solo | `ride.driverId = userId` | `status = 'accepted'` | ⏳ Pendiente |
| 5 | `upload_delivery_photo` | `driver` solo | `ride.driverId = userId` | `status = 'in_progress'` | ⏳ Pendiente |
| 6 | `get_payment_history` | `driver` solo | `driverId = userId` | Solo rides `paid` | ⏳ Pendiente |
| 7 | `get_driver_profile` | `client` / `driver` | Público (cualquier autenticado) | — | ⏳ Pendiente |

> **Regla:** Las tools marcadas "driver solo" requieren rol `driver`. Un cliente no puede gestionar viajes, proponer precios ni iniciar viajes. Tools compartidas como `send_message` y `get_driver_profile` están disponibles para ambos roles.

---

## Checklist de Integración Final

Cuando ambas partes hayan completado sus tools, ejecutar:

- [ ] `bun run typecheck` — sin errores de compilación
- [ ] `bun run src/index.ts` — server inicia y muestra "Tools registradas: 15"
- [ ] Probar `list_my_rides` + `create_ride` + `get_ride_details` (Ramses)
- [ ] Probar `view_offers` + `accept_offer` (Ramses)
- [ ] Probar `confirm_delivery` + `cancel_ride` + `rate_service` (Ramses)
- [ ] Probar `list_available_rides` (Justin)
- [ ] Probar `send_message` + `propose_price` (Justin)
- [ ] Probar `start_trip` + `upload_delivery_photo` (Justin)
- [ ] Probar `get_payment_history` + `get_driver_profile` (Justin)
- [ ] Probar flujo completo: create → propose_price → accept_offer → start_trip → upload_delivery_photo → confirm_delivery → rate_service

---

*Fin del documento de asignación*
