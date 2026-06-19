# ISSUE-002: Revisión Tool 2 — `create_ride`

> **Fecha**: 2026-06-19
> **Revisor**: Agente orquestador
> **Tool**: `create_ride` (src/tools/create-ride.ts)
> **Severidad Global**: ✅ Todos los issues resueltos — tool lista para producción

---

## RESUMEN GENERAL

La tool `create_ride` tiene una arquitectura general correcta (schema Zod, handler, transformación GeoJSON, auth flow). Se detectaron **6 issues** que fueron **todos resueltos**.

---

## LISTA DE ISSUES

### Issue 1: `images: []` causa rechazo inmediato del backend ✅ RESUELTO

- **Severidad**: 🔴 CRÍTICA
- **Archivo**: `mcp-server/src/tools/create-ride.ts:21` / `backend/src/routes/rides.ts:94`
- **Descripción**: El handler envía `images: []` (arreglo vacío), pero el backend valida explícitamente que `images.length > 0`. La creación del ride fallará SIEMPRE con "Se requiere al menos una imagen del pedido".
- **Solución aplicada**: Opción A — Se eliminó `'images'` del array `required` en backend (`routes/rides.ts:94`) y se eliminó la validación de `images.length > 0`. La validación de máximo 8 imágenes ahora es condicional (solo si `body.images` existe). El modelo Mongoose ya permitía arreglos vacíos.

---

### Issue 2: `stripePaymentMethodId` no gestionado por el MCP ✅ RESUELTO

- **Severidad**: 🔴 CRÍTICA
- **Archivo**: `mcp-server/src/tools/create-ride.ts` / `backend/src/routes/rides.ts`
- **Descripción**: El backend requiere `stripePaymentMethodId` (lo busca en el body o en el perfil del usuario, y rechaza con 400 si no existe). El MCP no incluye este campo ni en el schema Zod ni en el body que envía. Depende únicamente de que el usuario tenga el método guardado en su perfil — si no lo tiene, falla con un error genérico.
- **Solución aplicada**: Se agregó pre-check en `create-ride.ts` que llama a `GET /api/users/me/payment-method` antes de hacer el POST. Si `hasPaymentMethod === false`, retorna error `PAYMENT_METHOD_REQUIRED` con instrucciones claras de agregar método en Carglyn.

---

### Issue 3: Tipo `RideType` inconsistente entre types.ts y backend ✅ RESUELTO

- **Severidad**: 🟡 Media
- **Archivo**: `mcp-server/src/types.ts:7` / `mcp-server/src/tools/create-ride.ts:20`
- **Descripción**: `RideType` define `'electrodomésticos'` (con acento), pero el backend normaliza y guarda como `'electrodomesticos'` (sin acento). Type mismatch silencioso.
- **Solución aplicada**: Se actualizó `RideType` en `types.ts` a `'electrodomesticos'` (sin acento). El schema Zod (`rideTypeEnum`) acepta ambos valores (`'electrodomesticos'` y `'electrodomésticos'`) para compatibilidad hacia atrás.

---

### Issue 4: `preferredDate` sin validación ISO 8601 ✅ RESUELTO

- **Severidad**: 🟡 Media
- **Archivo**: `mcp-server/src/schemas.ts:58`
- **Descripción**: `preferredDate` se validaba solo como `z.string().optional()` sin verificar formato ISO 8601.
- **Solución aplicada**: Se cambió a `z.string().datetime().optional()` que valida estrictamente formato ISO 8601 (ej: `2026-06-19T14:30:00Z`).

---

### Issue 5: `ListToolsRequestSchema` no expone `inputSchema` real ✅ RESUELTO

- **Severidad**: 🟡 Media
- **Archivo**: `mcp-server/src/index.ts:174-187`
- **Descripción**: El handler `ListToolsRequestSchema` siempre enviaba `inputSchema: { type: 'object', properties: {} }` para TODAS las tools.
- **Solución aplicada**: Se instaló `zod-to-json-schema` y se actualizó `listTools()` en `tools/index.ts` para retornar también el schema. El handler `ListToolsRequestSchema` ahora convierte cada `z.ZodSchema` a JSON Schema usando `zodToJsonSchema(schema, { target: 'openApi3' })`, retornando `properties`, `required`, tipos reales.

---

### Issue 6: Manejo de error genérico para método de pago faltante ✅ RESUELTO

- **Severidad**: 🟡 Media
- **Archivo**: `mcp-server/src/tools/create-ride.ts:43-53`
- **Descripción**: Cuando el backend rechaza por falta de `stripePaymentMethodId`, el catch lo transformaba a `BACKEND_ERROR` perdiendo semántica.
- **Solución aplicada**: Se agregó pre-check proactivo que llama a `GET /api/users/me/payment-method` antes de enviar al backend. Si no hay método, retorna error `PAYMENT_METHOD_REQUIRED` con código 400 y mensaje claro indicando que el usuario debe agregar un método de pago en Carglyn (el asistente IA no puede hacerlo por él).

---

## VEREDICTO FINAL

✅ **Todos los issues resueltos — tool lista para producción**

| Issue | Estado | Solución |
|-------|--------|----------|
| #1 🔴 images vacío | ✅ Resuelto | Backend: images opcional al crear |
| #2 🔴 stripePaymentMethodId | ✅ Resuelto | Pre-check GET /api/users/me/payment-method |
| #3 🟡 RideType acento | ✅ Resuelto | types.ts sin acento, schema acepta ambos |
| #4 🟡 preferredDate sin validación | ✅ Resuelto | z.string().datetime() |
| #5 🟡 inputSchema vacío | ✅ Resuelto | zod-to-json-schema en ListTools |
| #6 🟡 Error genérico método pago | ✅ Resuelto | PAYMENT_METHOD_REQUIRED con instrucciones |
