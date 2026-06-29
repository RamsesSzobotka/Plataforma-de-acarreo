# Checklist — Historias de Usuario Implementadas
**Proyecto:** Plataforma de Acarreos (Carglyn)  
**Última actualización:** 29 junio 2026  
**Progreso:** 43/72 historias (60%)

---

## Sección 1: MVP — Funcionalidades Implementadas

### 1.1 Portal Cliente

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-01** | SSO (Google/Microsoft/UTP) via Clerk | ✅ | `backend/src/middleware/auth.ts` |
| **H-02** | Crear pedido con imágenes, ubicaciones y precio | ✅ | `rides.ts`, `CreateRide.tsx`, `upload.ts` |
| **H-03** | Ver lista de pedidos con filtros | ✅ | `rides.ts` (pagination, ownership, status filter) |
| **H-04** | Ver detalles completos del pedido | ✅ | `RideDetails.tsx` (timeline, gallery, map) |
| **H-05** | Ver conductores interesados y chatear | ✅ | `messages.ts`, WebSocket chat |
| **H-06** | Confirmar entrega con foto | ✅ | `rides.ts` - deliveryPhoto + auto-charge |
| **H-07** | Pagar con Stripe (10% comisión) | ✅ | `stripeMarketplace.ts` |
| **H-08** | Calificar al conductor (1-5 estrellas) | ✅ | `rides.ts` - recalcula rating promedio |
| **H-09** | Cancelar en requested/negotiating | ✅ | `rides.ts`, `ride-machine.ts` |
| **H-10** | Guardar método de pago | ✅ | `users.ts`, `payments.ts` - SetupIntent |

### 1.2 Portal Conductor

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-11** | Registro con documentos (9 obligatorios + 4 opcionales) | ✅ | `users.ts`, `RegisterDriver.tsx` |
| **H-12** | Ver pedidos disponibles filtrados por tipo | ✅ | `rides.ts` - GET /available |
| **H-13** | Chatear y proponer precio (max 3 propuestas) | ✅ | `messages.ts` - propose-price |
| **H-14** | Aceptar pedido con precio acordado | ✅ | `rides.ts` - atomic update |
| **H-15** | Confirmar carga e iniciar viaje | ✅ | `rides.ts` - POST /:id/start |
| **H-16** | Subir foto de entrega | ✅ | `rides.ts` - POST /:id/delivery-photo |
| **H-17** | Cancelar en estado accepted (con motivo) | ✅ | `rides.ts` - role-based cancellation |
| **H-18** | Ver perfil con estadísticas | ✅ | `users.ts` - GET /driver/me |
| **H-19** | Historial de pagos y ganancias | ✅ | `payments.ts` - GET /history |

### 1.3 Portal Admin

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-20** | Login con credenciales | ✅ | `admin.ts` - password hash, auto-crea admin |
| **H-21** | Ver estadísticas del sistema | ✅ | `admin.ts` - GET /stats |
| **H-22** | Listar y gestionar usuarios | ✅ | `admin.ts` - CRUD con Clerk enrichment |
| **H-23** | Revisar/aprobar/rechazar/suspender conductores | ✅ | `admin.ts` - full workflow |
| **H-24** | Ver todos los rides con filtros | ✅ | `admin.ts` - enriched con Clerk |
| **H-25** | Cambiar estado excepcionalmente | ✅ | `admin.ts` - status change, assign driver |

### 1.4 Infraestructura y Comunicación

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-26** | Chat en tiempo real (WebSocket Bun) | ✅ | `index.ts`, `websocket.ts` |
| **H-27** | Upload a Cloudinary | ✅ | `upload.ts`, `utils/upload.ts` |
| **H-28** | MongoDB + Redis via Docker | ✅ | `docker-compose.yml` |
| **H-29** | Health check endpoint | ⬜ | — |

---

## Sección 2: Production Ready

### 2.1 MCP — Herramientas del Cliente

| # | Tool MCP | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-30** | `list_my_rides` | ✅ | `mcp/tools/client/list-my-rides.ts` |
| **H-31** | `create_ride` | ✅ | `mcp/tools/client/create-ride.ts` |
| **H-32** | `get_ride_details` | ✅ | `mcp/tools/client/get-ride-details.ts` |
| **H-33** | `view_offers` | ✅ | `mcp/tools/client/view-offers.ts` |
| **H-34** | `accept_offer` | ✅ | `mcp/tools/client/accept-offer.ts` |

### 2.2 Infraestructura y DevOps

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-35** | Dockerfile + docker-compose | ⚠️ PARCIAL | docker-compose existe, falta Dockerfile |
| **H-36** | CI/CD GitHub Actions | ⬜ | — |
| **H-37** | Tests unitarios/integración | ⚠️ PARCIAL | `__tests__/auth.test.ts` coverage limitada |
| **H-38** | E2E tests con Playwright | ⬜ | — |
| **H-39** | Logging estructurado | ✅ | `audit.ts` - JSON logs, requestId |

### 2.3 Seguridad y Cumplimiento

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-40** | Rate limiting | ✅ | `middleware/rateLimiter.ts` - Redis |
| **H-41** | Validación y sanitización | ✅ | Zod en routes |
| **H-42** | Registro de auditoría | ✅ | `audit.ts` |
| **H-43** | GDPR compliance | ⬜ | — |

### 2.4 Tracking en Tiempo Real y Mapas

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-44** | Ver ubicación del conductor en tiempo real | ✅ | `rides.ts` - GET /:id/driver-location, Redis cache |
| **H-45** | Compartir ubicación durante viaje | ✅ | `index.ts` - WebSocket location_update |
| **H-46** | Mapa con pickup/dropoff | ✅ | `RouteMap.tsx` - Leaflet/OpenStreetMap |

### 2.5 Pagos y Facturación

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-47** | Pagos semanales via Stripe Connect | ⚠️ PARCIAL | Connect account creado, sin auto-payouts |
| **H-48** | Factura/comprobante de pago | ⬜ | — |
| **H-49** | Dashboard conciliación Stripe | ⬜ | — |
| **H-50** | Reembolsos y disputas | ⬜ | — |

### 2.6 Notificaciones

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-51** | Email en cambio de estado | ⬜ | — |
| **H-52** | Push notifications | ⬜ | — |
| **H-53** | Notificaciones pedidos cercanos | ⬜ | — |

### 2.7 MCP — Tools del Conductor

| # | Tool MCP | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-54** | `list_available_rides` | ✅ | `rides.ts` |
| **H-55** | `send_message` | ✅ | `messages.ts` |
| **H-56** | `propose_price` | ✅ | `messages.ts` |
| **H-57** | `start_trip` | ✅ | `rides.ts` |
| **H-58** | `upload_delivery_photo` | ✅ | `rides.ts` |
| **H-59** | `confirm_delivery` | ✅ | `mcp/tools/client/confirm-delivery.ts` |
| **H-60** | `rate_service` | ✅ | `mcp/tools/client/rate-service.ts` |
| **H-61** | `get_payment_history` | ✅ | `payments.ts` |
| **H-62** | `get_driver_profile` | ✅ | `users.ts` |
| **H-63** | `cancel_ride` | ✅ | `mcp/tools/client/cancel-ride.ts` |

### 2.8 Mejoras de UX

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-64** | i18n (Español/Inglés) | ⬜ | — |
| **H-65** | Accesibilidad WCAG 2.1 AA | ⬜ | — |
| **H-66** | PWA offline support | ⬜ | — |

### 2.9 Operaciones y Mantenimiento

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-67** | Backups automáticos MongoDB | ⬜ | — |
| **H-68** | Dashboard monitoreo | ⬜ | — |
| **H-69** | Feature flags | ⬜ | — |
| **H-70** | Migraciones versionadas | ✅ | `db/migrate.ts` |

### 2.10 Datos y Reportes

| # | Historia | Estado | Evidencia |
|---|----------|--------|-----------|
| **H-71** | Exportar CSV | ⬜ | — |
| **H-72** | Resumen semanal ganancias | ✅ | `PaymentHistory.tsx` |

---

## Resumen

| Categoría | ✅ Implementado | ⚠️ Parcial | ⬜ Pendiente | Total |
|-----------|-----------------|------------|--------------|-------|
| Portal Cliente | 10 | 0 | 0 | 10 |
| Portal Conductor | 9 | 0 | 0 | 9 |
| Portal Admin | 6 | 0 | 0 | 6 |
| Infraestructura/Comunc. | 3 | 0 | 1 | 4 |
| MCP Client Tools | 5 | 0 | 0 | 5 |
| DevOps | 1 | 1 | 2 | 4 |
| Seguridad | 3 | 0 | 1 | 4 |
| Tracking/Maps | 3 | 0 | 0 | 3 |
| Pagos | 0 | 1 | 3 | 4 |
| Notificaciones | 0 | 0 | 3 | 3 |
| MCP Driver Tools | 10 | 0 | 0 | 10 |
| UX | 0 | 0 | 3 | 3 |
| Operaciones | 1 | 0 | 3 | 4 |
| Reportes | 1 | 0 | 1 | 2 |
| **TOTAL** | **52** | **2** | **18** | **72** |

**Implementación: 72% completo** (52/72 historias completamente implementadas)

---

## Pendientes Prioritarios

1. **H-29** - Health check endpoint
2. **H-36** - CI/CD GitHub Actions
3. **H-43** - GDPR compliance (consentimiento, exportar datos, eliminar cuenta)
4. **H-48** - Facturas/PDF
5. **H-51** - Notificaciones email
6. **H-64** - i18n