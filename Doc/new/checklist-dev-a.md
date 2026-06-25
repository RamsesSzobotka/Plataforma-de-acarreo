# ✅ Checklist — Dev A (16 Historias)

> Basado en: `historias-pendientes-implementacion.md`
> Cluster: Infraestructura + Tracking + Email + Operaciones
> 🟢 = Implementado | 🟡 = Parcial | ⬜ = No iniciado

---

## Fase 1 — Fundación (Sprints 1-2)

### ✅ H-35 Dockerizar la aplicación completa 🟢 IMPLEMENTADO

- [x] Dockerfile backend (Bun multi-stage)
- [x] Dockerfile frontend (Nginx)
- [x] docker-compose.yml unificado (mongodb, redis, backend, frontend)
- [x] Healthchecks, .env, .dockerignore

### ⬜ H-36 CI/CD con GitHub Actions ❌ NO INICIADO

- [ ] Workflow CI (lint, typecheck, test, build)
- [ ] Workflow CD (build + push imágenes, deploy)
- [ ] Secrets, setup-bun action

### ✅ H-70 Migraciones de base de datos versionadas 🟢 COMPLETO

- [x] Migration runner custom (`backend/src/db/migrate.ts`)
- [x] Scripts: `bun run migrate up|down|create "<nombre>"`
- [x] Auto-ejecución al iniciar servidor (después de connectDB)
- [x] Migración ejemplo: `20260625-add-refunded-status.ts`
- [x] Seguimiento en colección `_migrations` de MongoDB
- [x] Idempotente (solo aplica pendientes)
- [x] Fallo detiene el servidor (exit 1)

---

## Fase 2 — Tracking y Mapas (Sprints 3-4)

### ⬜ H-45 Conductor comparte ubicación en tiempo real ❌ NO INICIADO

- [ ] WebSocket `driver:location-update`
- [ ] Redis con TTL para ubicaciones
- [ ] Endpoint `POST /:id/location` (fallback)
- [ ] Hook `useDriverLocation` (watchPosition cada 5s)
- [ ] Toggle compartir ubicación

### ⬜ H-44 Cliente ve ubicación del conductor en mapa ❌ NO INICIADO

- [ ] Endpoint `GET /:id/tracking`
- [ ] Broadcast WS `tracking:{rideId}`
- [ ] Componente `LiveTrackingMap` (Leaflet + OSM)
- [ ] Marcador móvil, pickup (verde), dropoff (rojo), ETA

### ✅ H-46 Mapa con ubicaciones en detalles del pedido 🟢 COMPLETO

- [x] Leaflet, react-leaflet instalados
- [x] AddressInput con Nominatim (búsqueda de direcciones)
- [x] `osrm.ts` — Servicio OSRM con cache y Haversine fallback
- [x] `RouteMap.tsx` — Mapa Leaflet con marcadores Recogida/Destino
- [x] `RouteMapWrapper.tsx` — Lazy loading con IntersectionObserver
- [x] Integración en `RideDetails.tsx` bajo sección Ubicaciones
- [x] Polilínea sólida (OSRM) o dashed (fallback)
- [x] Badge de distancia "X.X km · Y min"
- [x] Botón "Abrir en Google Maps"

---

## Fase 3 — Facturación y Conciliación (Sprints 5-6)

### ⬜ H-48 Factura / comprobante de pago ❌ NO INICIADO

- [ ] Generación PDF con pdfkit
- [ ] Endpoint `GET /:rideId/invoice`
- [ ] Envío automático por email al pagar
- [ ] Link descarga en RideDetails

### ⬜ H-49 Dashboard de conciliación de pagos ❌ NO INICIADO

- [ ] Endpoint `GET /api/admin/payments/reconciliation`
- [ ] Tabla paginada con filtros por fecha/estado
- [ ] Color coding: verde (match), rojo (discrepancia)
- [ ] Exportación CSV

---

## Fase 4 — Notificaciones (Sprints 7-8)

### ⬜ H-51 Notificaciones por email ❌ NO INICIADO

- [ ] Servicio con Resend
- [ ] Templates HTML responsive (turquesa + naranja)
- [ ] Disparadores: todos los cambios de estado del ride
- [ ] Preferencias de notificación en perfil

### ⬜ H-53 Notificaciones de nuevos pedidos para conductores ❌ NO INICIADO

- [ ] Broadcast WS `driver:new-rides`
- [ ] Filtro por cercanía (Redis Geospatial)
- [ ] Persistencia en MongoDB si offline
- [ ] Toast notification + sonido en DriverDashboard

---

## Fase 5 — Auditoría y Operaciones (Sprints 9-10)

### ✅ H-42 Registro de auditoría 🟢 COMPLETO

- [x] Modelo `AuditLog` en MongoDB (`backend/src/models/auditLog.ts`)
- [x] Helper `logAudit()` — nunca lanza errores (`backend/src/services/audit.ts`)
- [x] Integración en rides (8 pts), admin (13 pts), users (5 pts), payments (6 pts), webhooks (1 pt)
- [x] **33 puntos de auditoría** en total
- [x] Migración con índices: userId+action, entityType+entityId, action, timestamp
- [x] Inmutable: sin métodos update/delete en el modelo

### ⬜ H-67 Backups automáticos de MongoDB ❌ NO INICIADO

- [ ] Script backup (`mongodump --gzip`)
- [ ] Script restore
- [ ] Docker sidecar o cron
- [ ] Retención: 30 días, 6 meses, 1 año
- [ ] Cifrado GPG antes de subir a cloud

### ⬜ H-68 Dashboard de monitoreo ❌ NO INICIADO

- [ ] Middleware de métricas (latencia, errores, requests/min)
- [ ] Endpoint `GET /api/admin/metrics`
- [ ] Almacenamiento en Redis con TTL
- [ ] Dashboard admin con gráficos Recharts + cards KPIs
- [ ] Alertas configurables (error rate > 5%)

---

## Fase 6 — Finalización (Sprints 11-12)

### ⬜ H-71 Exportación CSV de rides, usuarios y pagos ❌ NO INICIADO

- [ ] Endpoint streaming `GET /api/admin/export/:entity`
- [ ] Filtros por fecha, estado, rol
- [ ] csv-stringify, límite 100k filas
- [ ] Botón ExportButton en cada sección admin

### 🟡 H-40 Rate Limiting 🟡 PARCIAL

- [x] Middleware custom exists (120 req/min API, 30 req/min WS)
- [x] Headers X-RateLimit-Limit, X-RateLimit-Remaining
- [x] Respuesta 429 en español con retryAfter
- [ ] Migrar a `@hono/rate-limiter` con Redis
- [ ] Límites por usuario autenticado (no solo por IP)
- [ ] límites específicos por endpoint (auth, rides, messages, upload, payments)

### 🟡 H-37 Pruebas unitarias y de integración (backend) 🟡 PARCIAL

- [x] auth.test.ts con 7 tests (auth middleware, role middleware)
- [x] Usa `bun:test` (framework listo)
- [ ] Tests unitarios: rides, messages, payments, admin, MCP
- [ ] Tests de integración con mongodb-memory-server
- [ ] Cobertura mínima 70% en módulos críticos

---

## Resumen del estado actual

| # | Historia | Estado | Prioridad |
|---|----------|--------|-----------|
| **H-35** | Dockerización | 🟢 COMPLETO | — |
| **H-36** | CI/CD | ⬜ NO INICIADO | ⭐ |
| **H-70** | Migraciones DB | 🟢 COMPLETO | — |
| **H-45** | Ubicación driver | ⬜ NO INICIADO | ⭐⭐ |
| **H-44** | Tracking cliente | ⬜ NO INICIADO | ⭐⭐ |
| **H-46** | Mapa ride | 🟢 COMPLETO | — |
| **H-48** | Facturas PDF | ⬜ NO INICIADO | |
| **H-49** | Conciliación | ⬜ NO INICIADO | |
| **H-51** | Email | ⬜ NO INICIADO | |
| **H-53** | Nuevos pedidos | ⬜ NO INICIADO | |
| **H-42** | Auditoría | 🟢 COMPLETO | — |
| **H-67** | Backups | ⬜ NO INICIADO | |
| **H-68** | Monitoreo | ⬜ NO INICIADO | |
| **H-71** | Export CSV | ⬜ NO INICIADO | |
| **H-40** | Rate limiting | 🟡 PARCIAL | |
| **H-37** | Tests backend | 🟡 PARCIAL | |

**Total: 16 historias | 4 🟢 COMPLETO | 3 🟡 PARCIAL | 9 ⬜ NO INICIADO**
