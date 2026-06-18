# Asignación de Responsabilidades — MCP Server

> **Proyecto**: Plataforma de Acarreos — MCP Server
> **Fecha**: 2026-06-18

---

## Distribución de Tools (5 por desarrollador)

### Lógica de División

Para evitar conflictos y dependencias cruzadas, las tools se dividen por **rol del usuario final**:

| Desarrollador | Perfil | Tools |
|---------------|--------|-------|
| **Ramses Szobotka** | 🧑‍💼 **Cliente-side** | Las que usan clientes para publicar y gestionar acarreos |
| **Justin Barrios** | 🚚 **Conductor-side** | Las que usan conductores para encontrar y gestionar acarreos |

Ninguna tool de un desarrollador depende de una tool del otro para funcionar o probarse de forma aislada.

---

### 🧑‍💼 Ramses Szobotka — 5 Tools (Cliente)

| # | Tool | Archivo | Estado |
|---|------|---------|--------|
| 1 | `list_my_rides` | `src/tools/list-my-rides.ts` | ⏳ Pendiente |
| 2 | `create_ride` | `src/tools/create-ride.ts` | ⏳ Pendiente |
| 3 | `get_ride_details` | `src/tools/get-ride-details.ts` | ⏳ Pendiente |
| 7 | `view_offers` | `src/tools/view-offers.ts` | ⏳ Pendiente |
| 8 | `accept_offer` | `src/tools/accept-offer.ts` | ⏳ Pendiente |

**Responsabilidades**:
- Implementar Tool 1 `list_my_rides`
- Implementar Tool 2 `create_ride`
- Implementar Tool 3 `get_ride_details`
- Implementar Tool 7 `view_offers` (ver ofertas de conductores en mi acarreo)
- Implementar Tool 8 `accept_offer` (aceptar oferta de un conductor)
- Registrar las 5 tools en `src/index.ts` al completarlas

**Endpoints backend requeridos** (crear si no existen):
- `GET /api/rides/:id/offers` — para Tool 7 (view_offers)

---

### 🚚 Justin Barrios — 5 Tools (Conductor)

| # | Tool | Archivo | Estado |
|---|------|---------|--------|
| 4 | `list_available_rides` | `src/tools/list-available-rides.ts` | ⏳ Pendiente |
| 5 | `get_available_ride_details` | `src/tools/get-available-ride-details.ts` | ⏳ Pendiente |
| 6 | `send_offer` | `src/tools/send-offer.ts` | ⏳ Pendiente |
| 9 | `update_ride_status` | `src/tools/update-ride-status.ts` | ⏳ Pendiente |
| 10 | `get_ride_history` | `src/tools/get-ride-history.ts` | ⏳ Pendiente |

**Responsabilidades**:
- Implementar Tool 4 `list_available_rides`
- Implementar Tool 5 `get_available_ride_details`
- Implementar Tool 6 `send_offer`
- Implementar Tool 9 `update_ride_status` (actualizar estado del acarreo: in_progress / completed)
- Implementar Tool 10 `get_ride_history` (historial de acarreos completados)
- Registrar las 5 tools en `src/index.ts` al completarlas

**Endpoints backend requeridos** (crear si no existen):
- `PATCH /api/rides/:id/status` — para Tool 9 (update_ride_status)

---

## Dependencias Compartidas

### Ambos desarrolladores deben respetar

| Archivo | Propósito | Regla |
|---------|-----------|-------|
| `src/types.ts` | Interfaces compartidas | No modificar sin coordinación |
| `src/schemas.ts` | Schemas Zod de validación | Agregar schemas nuevos al final, no modificar existentes |
| `src/errors.ts` | Clases de error | No modificar |
| `src/api-client.ts` | Cliente HTTP | No modificar |
| `src/tools/index.ts` | Registro de tools | Ya completo, no modificar |

### Pasos al completar cada tool

1. Crear el archivo handler en `src/tools/<tool-name>.ts`
2. Descomentar el `import` correspondiente en `src/index.ts`
3. Descomentar `registerTool(...)` en `src/index.ts`
4. Agregar la tool a `ListToolsRequestSchema` en `src/index.ts`
5. Agregar al Map en `initToolHandlers()` en `src/index.ts`
6. Ejecutar `bun run typecheck` para verificar compilación
7. Ejecutar `bun run src/index.ts` para probar que el servidor inicia

---

## Checklist de Integración Final

Cuando ambas partes hayan completado sus tools, ejecutar:

- [ ] `bun run typecheck` — sin errores de compilación
- [ ] `bun run src/index.ts` — server inicia y muestra "Tools registradas: 10"
- [ ] Probar `list_my_rides` (Ramses)
- [ ] Probar `create_ride` + `get_ride_details` (Ramses)
- [ ] Probar `list_available_rides` + `get_available_ride_details` (Justin)
- [ ] Probar `send_offer` + `view_offers` + `accept_offer` (integración completa)
- [ ] Probar `update_ride_status` (Justin)
- [ ] Probar `get_ride_history` (Justin)

---

*Fin del documento de asignación*
