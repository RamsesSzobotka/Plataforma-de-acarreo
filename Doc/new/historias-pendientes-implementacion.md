# Historias Pendientes — Guía de Implementación

> Basado en: `Historias-de-Usuario-MVP-a-Production-Ready.md`
> Excluye: Historias [MCP] (H-30 a H-34, H-54 a H-63)
> Total: **28 historias por implementar**

---

## Índice

- [2.2 Infraestructura y DevOps](#22-infraestructura-y-devops)
- [2.3 Seguridad y Cumplimiento](#23-seguridad-y-cumplimiento)
- [2.4 Tracking en Tiempo Real y Mapas](#24-tracking-en-tiempo-real-y-mapas)
- [2.5 Pagos y Facturación](#25-pagos-y-facturación)
- [2.6 Notificaciones y Comunicación](#26-notificaciones-y-comunicación)
- [2.8 Mejoras de UX](#28-mejoras-de-ux)
- [2.9 Operaciones y Mantenimiento](#29-operaciones-y-mantenimiento)
- [2.10 Datos y Reportes](#210-datos-y-reportes)
- [Orden de Implementación Recomendado](#orden-de-implementación-recomendado)

---

## 2.2 Infraestructura y DevOps

### H-35: Dockerizar la aplicación completa

**Historia**: Como equipo de desarrollo, quiero tener Dockerfile para el backend y docker-compose para toda la aplicación (backend + frontend + DB + Redis), para desplegar fácilmente en cualquier entorno.

**Implementación**:

- **Backend Dockerfile**: Multi-stage con Bun. Stage 1: `oven/bun:1-slim` para instalar dependencias y build. Stage 2: `oven/bun:1-slim` para correr en producción.
- **Frontend Dockerfile**: Multi-stage. Stage 1: Build con Node+Vite. Stage 2: `nginx:alpine` sirviendo el build estático.
- **docker-compose.yml unificado** con servicios:
  - `mongodb`: mongo:7 con healthcheck, volumen persistente, puerto 27017
  - `redis`: redis:7-alpine, puerto 6379
  - `backend`: construido desde `./backend`, depende de mongodb+redis, variables de entorno
  - `frontend`: construido desde `./frontend`, puerto 80, depende de backend
- **Variables de entorno**: Usar archivo `.env` en la raíz del proyecto, referenciado desde docker-compose.
- **Healthchecks**: Cada servicio debe tener healthcheck configurado.

**Aspectos a considerar**:
- Bun no tiene imagen oficial slim estable — usar `oven/bun:1-slim` o `oven/bun:1-alpine`.
- El build de frontend necesita `VITE_API_URL` apuntando al backend en Docker network (`http://backend:3000`).
- En desarrollo, usar volúmenes bind mount para hot reload.
- Redis se usa para rate limiting (H-40) y tracking en tiempo real (H-44, H-45) — aunque no esté integrado aún, debe estar disponible.
- Seguridad: no exponer MongoDB ni Redis al host en producción.

**Archivos afectados**:
- `backend/Dockerfile` (nuevo)
- `frontend/Dockerfile` (nuevo)
- `docker-compose.yml` (nuevo, raíz del proyecto)
- `.env.example` (actualizar)
- `backend/.dockerignore`
- `frontend/.dockerignore`

---

### H-36: CI/CD con GitHub Actions

**Historia**: Como equipo de desarrollo, quiero tener CI/CD con GitHub Actions (lint, test, build, deploy), para automatizar la calidad y entrega del software.

**Implementación**:

- **Workflow de CI** (`.github/workflows/ci.yml`):
  - Trigger: pull request a `main` y `develop`
  - Jobs:
    1. `lint`: `bun run lint` (backend) y `bun run lint` (frontend)
    2. `typecheck`: `bun run typecheck` (tsc --noEmit)
    3. `test`: `bun run test` con MongoDB de test (usar `mongodb-memory-server` o Docker service)
    4. `build`: `bun run build` en backend y frontend

- **Workflow de CD** (`.github/workflows/deploy.yml`):
  - Trigger: push a `main`
  - Jobs:
    1. Build y push de imágenes Docker a Docker Hub / GHCR
    2. Deploy a servidor (SSH + docker-compose pull && up -d)
  - Secrets requeridos: `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `SSH_HOST`, `SSH_KEY`, `SSH_USER`

**Aspectos a considerar**:
- Bun no está disponible en los runners de GitHub por defecto — usar acción `oven-sh/setup-bun@v1`.
- Los tests que requieren MongoDB pueden usar `mongodb-memory-server` para evitar levantar servicio externo.
- Los secrets deben gestionarse desde GitHub Secrets, no en el código.
- Para deploy, considerar usar `appleboy/ssh-action@v1` para ejecutar comandos remotos.
- No incluir deployment si no hay servidor disponible aún — el CI igual es valioso.

**Archivos afectados**:
- `.github/workflows/ci.yml` (nuevo)
- `.github/workflows/deploy.yml` (nuevo)
- `backend/package.json` (agregar scripts `lint`, `typecheck`, `test` si faltan)
- `frontend/package.json` (igual)

---

### H-37: Pruebas unitarias y de integración

**Historia**: Como equipo de desarrollo, quiero tener pruebas unitarias e integración para todos los módulos (auth, rides, messages, payments, admin, MCP), para garantizar la calidad del código.

**Implementación**:

- **Framework**: Usar Bun test (`bun test`) — es nativo, rápido, compatible con Jest API.
- **Estructura**: Tests junto al código fuente (`*.test.ts`) o en `backend/src/__tests__/`.

- **Tests unitarios por módulo**:
  - **Auth**: Webhook de Clerk, creación de usuario, middleware de auth (token válido, expirado, sin token)
  - **Rides**: CRUD, cambios de estado, reglas de negocio (no cancelar en `accepted`, race condition al aceptar)
  - **Messages**: Enviar, leer, marcar como leídos, validaciones
  - **Payments**: Crear PaymentIntent, webhook de Stripe, cálculo de comisión 10%
  - **Admin**: CRUD de usuarios, aprobar/rechazar conductores, estadísticas

- **Tests de integración**:
  - Usar `mongodb-memory-server` para base de datos en memoria
  - Setup global: conectar a DB, limpiar colecciones entre tests
  - Flujo completo: crear ride -> chat -> aceptar -> iniciar -> completar -> pagar -> calificar
  - Tests de WebSocket: conectar, enviar mensaje, recibir broadcast

- **Cobertura objetivo**: Mínimo 70% en módulos críticos (rides, payments, auth).

**Aspectos a considerar**:
- Separar tests unitarios (mock de DB) de tests de integración (DB real en memoria).
- Usar `beforeAll`/`afterAll` para conexión de base de datos.
- Los tests de WebSocket requieren levantar un servidor Hono de prueba.
- Para Stripe, usar `stripe-mock` o mockear manualmente las llamadas HTTP.
- Incluir tests de schemas Zod (validación de inputs) — son rápidos y detectan errores temprano.

**Archivos afectados**:
- `backend/src/**/*.test.ts` (múltiples archivos)
- `backend/src/__tests__/setup.ts` (nuevo)
- `backend/src/__tests__/integration/` (nueva carpeta)
- `backend/package.json` (script `test`)

---

### H-38: Tests E2E con Playwright

**Historia**: Como equipo de desarrollo, quiero tener tests E2E con Playwright para los flujos críticos, para validar la experiencia de usuario completa.

**Implementación**:

- **Setup**:
  - Instalar `@playwright/test` en frontend
  - Configurar `playwright.config.ts` con navegadores (Chromium, Firefox)
  - Usar modo UI para desarrollo, headless para CI

- **Flujos a testear**:
  1. **Registro + Crear pedido**: Cliente se registra -> crea pedido con imágenes -> ve en lista
  2. **Chat + Aceptar**: Conductor ve pedido -> chatea -> negocia -> acepta
  3. **Tracking + Completar**: Conductor inicia viaje -> sube foto -> cliente confirma
  4. **Pago + Calificar**: Cliente paga -> califica al conductor
  5. **Registro conductor**: Conductor llena formulario con documentos -> ve estado pending
  6. **Admin**: Admin inicia sesión -> ve estadísticas -> aprueba conductor
  7. **Cancelaciones**: Cliente cancela en `requested`, conductor cancela en `accepted`

**Aspectos a considerar**:
- Playwright requiere la app corriendo — considerar levantar backend+frontend antes de los tests.
- Usar `playwright.config.ts` con `webServer` para arrancar automáticamente.
- Los tests E2E son lentos — ejecutarlos solo en CI, no en desarrollo local cada vez.
- Mockear Clerk con interceptaciones de red (rutas de `/api/auth/*`).
- Incluir viewport mobile (375x667) para probar responsive.

**Archivos afectados**:
- `frontend/e2e/` (nueva carpeta)
- `frontend/e2e/flujo-completo.spec.ts`
- `frontend/e2e/registro-conductor.spec.ts`
- `frontend/e2e/admin.spec.ts`
- `frontend/playwright.config.ts` (nuevo)
- `frontend/package.json` (script `test:e2e`)

---

### H-39: Logging estructurado y centralizado

**Historia**: Como admin, quiero tener logging estructurado y centralizado, para debuggear y monitorear la plataforma.

**Implementación**:

- **Librería**: Usar `pino` (ultra-rápido, nativo JSON, soporte nativo en Bun).
- **Formato**: Cada log en JSON con campos:
  - `level`: `info`, `warn`, `error`, `debug`
  - `time`: timestamp ISO
  - `requestId`: correlación de request
  - `method`, `path`, `status`: para logs HTTP
  - `userId`: si hay usuario autenticado
  - `durationMs`: tiempo de respuesta
  - `module`: nombre del módulo (rides, auth, payments)
  - `error`: stack trace en errores

- **Middleware Hono** que registra cada request entrante.
- **Niveles por ambiente**:
  - Desarrollo: `info` + pretty print (`pino-pretty`)
  - Producción: `warn` o `error` a stdout JSON

**Aspectos a considerar**:
- No loggear información sensible (passwords, tokens, datos de tarjeta).
- `requestId` es crítico para correlacionar logs — implementar middleware que genere/propague `x-request-id`.
- En producción, logs van a stdout (no archivos) para que Docker los capturen.
- Incluir logs de WebSocket (conexión, desconexión, errores).
- Rotación de logs en desarrollo si se escribe a archivo.

**Archivos afectados**:
- `backend/src/middleware/logger.ts` (nuevo)
- `backend/src/index.ts` (agregar middleware)
- `backend/package.json` (agregar `pino`, `pino-pretty`)
- `backend/.env.example` (agregar `LOG_LEVEL`)

---

## 2.3 Seguridad y Cumplimiento

### H-40: Rate Limiting

**Historia**: Como sistema, quiero tener rate limiting por endpoint y por usuario, para prevenir abusos y ataques DoS.

**Implementación**:

- **Librería**: Usar `@hono/rate-limiter` con almacenamiento en Redis.
- **Redis**: Conexión via `ioredis` o `redis` de Bun (ya disponible en docker-compose).
- **Límites por endpoint**:
  - Global: 100 requests/min por IP
  - `/api/auth/*`: 10 requests/min
  - `/api/rides` (POST): 20 requests/min por usuario
  - `/api/messages`: 60 requests/min por usuario
  - `/api/upload`: 10 requests/min por usuario
  - `/api/payments/*`: 10 requests/min

- **Respuesta 429**: Devolver `Retry-After` header y cuerpo JSON con mensaje en español/inglés.

**Aspectos a considerar**:
- Redis debe estar disponible — si no hay conexión, fallback a `memoryStore` (menos preciso pero funcional).
- Los límites deben ser configurables via env vars (`RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX`).
- Distinguir entre rate limiting anónimo (por IP) y autenticado (por userId).
- No rate limitear el webhook de Clerk (viene de IP fija de Clerk).
- Usar ventanas deslizantes (sliding window) con INCR + EXPIRE de Redis.

**Archivos afectados**:
- `backend/src/middleware/rateLimiter.ts` (nuevo)
- `backend/src/index.ts` (aplicar middleware)
- `backend/package.json` (`hono-rate-limiter`, `rate-limit-redis`)
- `backend/.env.example` (agregar `REDIS_URL`)

---

### H-41: Validación y sanitización de inputs

**Historia**: Como sistema, quiero tener validación y sanitización de inputs en todos los endpoints, para prevenir inyección y XSS.

**Implementación**:

- **Zod**: Ya hay schemas en uso — extender a TODOS los endpoints. Cada ruta debe tener su schema de validación.
- **Validaciones específicas**:
  - Strings: límite de longitud (título max 200 chars, descripción max 2000, mensajes max 1000)
  - URLs: validar formato de Cloudinary para imágenes
  - Precios: números positivos, máximo 2 decimales
  - IDs: validar formato ObjectId de MongoDB
  - Coordenadas: lat -90/90, lng -180/180
  - Placa vehículo: formato específico (ej: `ABC-1234` para Panamá)

- **Sanitización**:
  - HTML escaping en mensajes y descripciones (evitar XSS)
  - Strip de caracteres de control en textos
  - Normalizar emails a minúsculas

- **Middleware global de errores Zod**: Capturar `ZodError` y devolver 400 con detalles claros.

- **Protección NoSQL injection**:
  - No pasar `req.body` directamente a MongoDB — siempre validar con Zod primero
  - Usar proyecciones explícitas en queries
  - No usar `$where` ni `$eval`

**Aspectos a considerar**:
- Los errores de validación deben ser claros para el frontend (campo + mensaje en español).
- Centralizar schemas reutilizables (ObjectId, coordenadas, precio) en un archivo `schemas/common.ts`.
- La sanitización de HTML aplica especialmente en chat (los mensajes se renderizan en el frontend).
- No confiar solo en frontend — backend debe validar absolutamente todo.

**Archivos afectados**:
- `backend/src/schemas/` (nuevo directorio con schemas Zod)
- `backend/src/schemas/common.ts`
- `backend/src/schemas/ride.ts`
- `backend/src/schemas/user.ts`
- `backend/src/schemas/message.ts`
- `backend/src/middleware/validate.ts` (nuevo middleware genérico)
- Cada ruta: agregar validación Zod antes del handler

---

### H-42: Registro de auditoría

**Historia**: Como sistema, quiero tener registro de auditoría de todas las acciones sensibles, para trazabilidad y compliance.

**Implementación**:

- **Modelo `AuditLog`** en MongoDB:
  ```typescript
  {
    _id: ObjectId,
    action: string,           // 'ride.status_change' | 'user.update' | 'admin.action'
    entityType: string,       // 'ride' | 'user' | 'driver'
    entityId: string,
    userId: string,
    userRole: string,
    details: object,          // before/after
    metadata: { ip: string, userAgent: string, timestamp: Date }
  }
  ```

- **Helper `logAudit()`** para registrar eventos desde cualquier parte del código.
- **Eventos a auditar**:
  - Cambios de estado de ride
  - Acciones de admin (aprobar/rechazar conductor, cancelación excepcional)
  - Cambios en perfiles (rol, documentos)
  - Intentos de pago y resultados

**Aspectos a considerar**:
- No auditar operaciones de solo lectura (GETs).
- Los logs de auditoría son inmutables — no permitir edición ni eliminación.
- Indexar por `userId`, `entityId`, `action` y `timestamp` para consultas eficientes.
- Incluir la IP y user agent para trazabilidad forense.
- Considerar retención: archivar logs mayores a 90 días.

**Archivos afectados**:
- `backend/src/models/auditLog.ts` (nuevo)
- `backend/src/services/audit.ts` (nuevo helper)
- `backend/src/routes/rides.ts` (integración en cambios de estado)
- `backend/src/routes/admin.ts` (integración)

---

### H-43: Protección GDPR / Privacidad

**Historia**: Como usuario, quiero que mi información personal esté protegida según GDPR/leyes de privacidad, para tener confianza en la plataforma.

**Implementación**:

- **Consentimiento al registro**: Checkbox obligatorio "Acepto la Política de Privacidad". Guardar timestamp del consentimiento.
- **Exportación de datos**: `GET /api/users/me/export-data` retorna JSON con perfil, rides, mensajes, pagos, calificaciones.
- **Eliminación de cuenta**: `DELETE /api/users/me` — anonimizar datos personales, mantener rides por integridad. Período de gracia de 30 días.
- **Política de privacidad**: Página estática `/privacy` explicando qué datos se recogen, para qué, derechos del usuario.

**Aspectos a considerar**:
- No eliminar rides completados por integridad del sistema.
- Anonimizar vs eliminar: datos personales se anonimizan, datos transaccionales se mantienen.
- Si el usuario tiene rides activos, bloquear eliminación hasta que se completen.
- Considerar Ley 81 de Protección de Datos Personales de Panamá.

**Archivos afectados**:
- `backend/src/routes/users.ts` (nuevos endpoints export/delete)
- `backend/src/services/privacy.ts` (nuevo)
- `frontend/src/pages/PrivacyPolicy.tsx` (nuevo)
- `frontend/src/pages/AccountSettings.tsx` (opciones de exportar/eliminar)

---

## 2.4 Tracking en Tiempo Real y Mapas

### H-44: Cliente ve ubicación del conductor en mapa

**Historia**: Como cliente, quiero ver la ubicación del conductor en tiempo real en un mapa durante el viaje, para saber cuándo llegará la mercancía.

**Implementación**:

- **Backend — Servicio de ubicaciones**:
  - Usar Redis para almacenar ubicaciones: `KEY: driver:{id}:location -> VALUE: { lat, lng, timestamp, rideId }`
  - TTL de 30 segundos por ubicación
  - Endpoint `GET /api/rides/:id/tracking` retorna ubicación actual

- **Frontend — Mapa**:
  - Usar Leaflet + OpenStreetMap (reutilizar AddressInput existente)
  - Componente `LiveTrackingMap`:
    - Marcador del conductor que se mueve
    - Marcadores de pickup (verde) y dropoff (rojo)
    - Polilínea de la ruta (OSRM)
    - Tiempo estimado de llegada (ETA)

- **WebSocket**: Cliente se suscribe a `tracking:{rideId}`. Conductor envía ubicación -> servidor actualiza Redis -> broadcast a suscriptores. Frecuencia: cada 5-10 segundos.

**Aspectos a considerar**:
- No guardar ubicaciones en MongoDB (demasiadas escrituras) — solo Redis con TTL corto.
- Leaflet es gratuito — no requiere API key.
- Si OSRM no responde, dibujar línea recta entre puntos.
- El tracking solo está activo mientras el estado es `in_progress`.

**Archivos afectados**:
- `backend/src/services/tracking.ts` (nuevo)
- `backend/src/routes/rides.ts` (endpoint tracking)
- `backend/src/index.ts` (canal WebSocket tracking)
- `frontend/src/components/LiveTrackingMap.tsx` (nuevo)
- `frontend/src/pages/RideDetails.tsx` (integrar condicional)

---

### H-45: Conductor comparte ubicación en tiempo real

**Historia**: Como conductor, quiero compartir mi ubicación en tiempo real mientras el viaje está en progreso, para que el cliente pueda trackear el progreso.

**Implementación**:

- **WebSocket**: Evento `driver:location-update` -> `{ rideId, lat, lng, timestamp }`
- Servidor valida: conductor asignado, ride `in_progress` -> actualiza Redis -> broadcast a `tracking:{rideId}`
- **API fallback**: `POST /api/rides/:id/location` si WebSocket falla
- **Frontend**: Usar `navigator.geolocation.watchPosition()` cada 5 segundos. Indicador visual "Compartiendo ubicación".

**Aspectos a considerar**:
- `watchPosition` requiere permiso del usuario — manejar error gracefully.
- No enviar ubicación si no cambió significativamente (>10 metros).
- El conductor debe poder dejar de compartir (toggle).
- No compartir ubicación cuando no hay viaje activo.

**Archivos afectados**:
- `backend/src/services/tracking.ts` (actualizar)
- `backend/src/routes/rides.ts` (endpoint `POST /:id/location`)
- `backend/src/index.ts` (handler WebSocket)
- `frontend/src/hooks/useDriverLocation.ts` (nuevo)
- `frontend/src/pages/ActiveTrip.tsx` (integrar)

---

### H-46: Mapa con ubicaciones en detalles del pedido

**Historia**: Como cliente, quiero ver el mapa con las ubicaciones de recogida y destino en los detalles del pedido, para visualizar geográficamente el servicio.

**Implementación**:

- **Componente `RouteMap`**: Leaflet + OpenStreetMap. Dos marcadores: pickup (verde) y dropoff (rojo). Polilínea de la ruta via OSRM. Distancia aproximada en km.
- **Integración**: En `RideDetails.tsx`, debajo de la información. Mapa lazy-loaded. Altura: ~300px desktop, ~200px mobile.
- **Cálculo de ruta**: `https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full`

**Aspectos a considerar**:
- Si OSRM falla, mostrar línea recta (fallback silencioso).
- Cachear ruta en sessionStorage.
- Botón "Abrir en Google Maps" con URL de direcciones.

**Archivos afectados**:
- `frontend/src/components/RouteMap.tsx` (nuevo)
- `frontend/src/pages/RideDetails.tsx` (integrar)
- `frontend/src/services/map.ts` (helper OSRM)

---

## 2.5 Pagos y Facturación

### H-47: Payouts semanales a conductores (Stripe Connect)

**Historia**: Como conductor, quiero recibir pagos automáticos semanales a mi cuenta bancaria via Stripe Connect, para tener ingresos predecibles.

**Implementación**:

- **Stripe Connect**: Crear Express account para cada conductor verificado. Endpoint `POST /api/payments/connect-onboarding` -> retorna `accountLink.url`.
- **Guardar** `stripeConnectAccountId` en el perfil del conductor.
- **Acumular balance**: Al completar pago, transferir 90% a la cuenta Connect del conductor (inmediato o agrupado semanalmente).
- **Cron job semanal**: Consultar rides `paid` de la semana, agrupar por conductor, crear transferencia Stripe.
- **Modelo `Payout`**: `{ driverId, amount, periodStart, periodEnd, rides[], stripeTransferId, status }`

**Aspectos a considerar**:
- Stripe Connect requiere verificación KYC del conductor.
- En fase inicial, transferencias inmediatas por ride son más simples.
- Manejar fallos de transferencia con retry y notificación.

**Archivos afectados**:
- `backend/src/routes/payments.ts` (endpoints Connect)
- `backend/src/services/payouts.ts` (nuevo, cron job)
- `backend/src/models/payout.ts` (nuevo)
- `backend/src/models/driver.ts` (agregar `stripeConnectAccountId`)
- `frontend/src/pages/DriverOnboarding.tsx` (nuevo)

---

### H-48: Factura / comprobante de pago

**Historia**: Como cliente, quiero recibir una factura o comprobante de pago por cada servicio, para mis registros contables.

**Implementación**:

- **Generación de PDF** con `pdfkit` (backend). Template con: logo, número de factura, datos cliente/servicio/conductor, montos, comisión 10%.
- **Endpoint**: `GET /api/payments/:rideId/invoice` retorna PDF. Solo cliente o admin.
- **Envío automático**: Al confirmarse el pago (webhook Stripe), enviar PDF por email adjunto.
- **Historial**: Cada ride `paid` tiene link "Descargar factura".

**Aspectos a considerar**:
- Alternativa a pdfkit: generar HTML + `puppeteer` (más control de diseño pero más pesado).
- Los números de factura deben ser secuenciales y únicos.
- Cachear el PDF generado (no regenerar cada vez).

**Archivos afectados**:
- `backend/src/services/invoice.ts` (nuevo)
- `backend/src/services/email.ts` (nuevo)
- `backend/src/routes/payments.ts` (endpoint invoice)
- `frontend/src/pages/RideDetails.tsx` (link descarga)

---

### H-49: Dashboard de conciliación de pagos

**Historia**: Como admin, quiero tener un dashboard de conciliación de pagos con Stripe, para verificar que todos los pagos coinciden.

**Implementación**:

- **Backend**: `GET /api/admin/payments/reconciliation` -> compara rides `paid` en MongoDB con PaymentIntents en Stripe.
- **Columnas**: rideId, cliente, monto esperado, monto Stripe, comisión, diferencia, estado.
- **Frontend**: Tabla paginada con filtros por fecha, estado. Color coding: verde (match), rojo (discrepancia).
- **Exportación CSV**: Botón "Exportar CSV".

**Aspectos a considerar**:
- Stripe es la fuente de verdad — la conciliación es informativa.
- Botón "Reconciliar ride" para forzar verificación manual.
- Cachear resultados de Stripe para no exceder rate limits.

**Archivos afectados**:
- `backend/src/routes/admin.ts` (endpoints conciliación)
- `backend/src/services/reconciliation.ts` (nuevo)
- `frontend/src/pages/admin/ReconciliationDashboard.tsx` (nuevo)

---

### H-50: Reembolsos y disputas

**Historia**: Como admin, quiero poder procesar reembolsos y disputas desde el panel, para manejar casos excepcionales.

**Implementación**:

- **Reembolso**: `POST /api/admin/payments/:rideId/refund` -> `stripe.refunds.create()`. Solo rides `paid`. Motivo requerido. Cambia estado a `refunded`.
- **Disputas**: Webhook `charge.dispute.created` -> modelo `Dispute`. Panel para ver detalle y responder.
- **Modelo `Dispute`**: `{ stripeDisputeId, rideId, amount, reason, status, evidenceSubmitted, respondBy }`

**Aspectos a considerar**:
- Stripe tiene ventana de 120 días para reembolsos.
- Disputas tienen deadline — mostrar countdown si < 48h.
- Stripe cobra fee por disputa ($15).
- No permitir reembolso parcial en MVP.

**Archivos afectados**:
- `backend/src/routes/admin.ts` (endpoints refund/disputes)
- `backend/src/models/dispute.ts` (nuevo)
- `backend/src/services/stripe.ts` (refund handlers)
- `backend/src/index.ts` (webhooks dispute)
- `frontend/src/pages/admin/RefundsPage.tsx` (nuevo)
- `frontend/src/pages/admin/DisputesPage.tsx` (nuevo)

---

## 2.6 Notificaciones y Comunicación

### H-51: Notificaciones por email

**Historia**: Como usuario, quiero recibir notificaciones por email cuando cambia el estado de mi pedido, para estar informado sin revisar la app.

**Implementación**:

- **Proveedor**: **Resend** (moderno, Bun-friendly, buen free tier) o SendGrid.
- **Templates HTML** con diseño responsive (turquesa + naranja, branding).
- **Disparadores**: ride creado, conductor interesado, aceptado, viaje iniciado, foto subida, completado, pagado, cancelado, calificación recibida.
- **Servicio** `email.ts`: función `sendEmail({ to, subject, html })` via API REST.
- **Preferencias**: toggle "Recibir notificaciones por email" en perfil.

**Aspectos a considerar**:
- No enviar emails en desarrollo (flag `DISABLE_EMAILS=true`).
- Incluir unsubscribe link en cada email (requisito legal).
- Rate limiting: no más de 10 emails por minuto por usuario.

**Archivos afectados**:
- `backend/src/services/email.ts` (nuevo)
- `backend/src/services/email/templates/` (carpeta con templates)
- `backend/src/services/rideNotifications.ts` (orquestador)
- `backend/.env.example` (`RESEND_API_KEY`, `EMAIL_FROM`)

---

### H-52: Notificaciones push móvil

**Historia**: Como usuario, quiero recibir notificaciones push en mi móvil cuando recibo un mensaje, para responder rápidamente.

**Implementación**:

- **Web Push API**: Service worker maneja push events. Suscripción via `pushManager.subscribe()`.
- **Guardar suscripciones**: `pushSubscriptions` colección en MongoDB.
- **Eventos push**: nuevo mensaje, nueva propuesta, oferta aceptada/rechazada, cambio de estado.
- **Librería**: `web-push` para Node/Bun.

**Aspectos a considerar**:
- Web Push solo funciona en HTTPS (o localhost).
- VAPID keys con `npx web-push generate-vapid-keys`.
- iOS Safari soporta desde 16.4+.
- El usuario puede desactivar desde el browser.

**Archivos afectados**:
- `backend/src/routes/notifications.ts` (nuevo)
- `backend/src/models/pushSubscription.ts` (nuevo)
- `backend/src/services/pushNotifications.ts` (nuevo)
- `frontend/src/hooks/usePushNotifications.ts` (nuevo)
- `frontend/public/sw.js` (service worker)
- `backend/package.json` (`web-push`)

---

### H-53: Notificaciones de nuevos pedidos para conductores

**Historia**: Como conductor, quiero recibir notificaciones cuando hay nuevos pedidos disponibles cerca de mi ubicación, para ser el primero en ofertar.

**Implementación**:

- **WebSocket**: Conductores autenticados se suscriben a `driver:new-rides`. Broadcast al crear ride.
- **Filtro por cercanía** (opcional): Usar Redis Geospatial (`GEORADIUS`) si el conductor compartió ubicación.
- **Persistencia**: Si el conductor no está conectado, guardar en MongoDB y enviar al reconectarse.
- **Frontend**: Toast notification en dashboard. Sonido opcional.

**Aspectos a considerar**:
- No notificar si el conductor tiene viaje activo.
- El conductor debe poder pausar notificaciones.
- No enviar datos sensibles del cliente en el broadcast.

**Archivos afectados**:
- `backend/src/index.ts` (canal `driver:new-rides`)
- `backend/src/routes/rides.ts` (broadcast al crear)
- `backend/src/models/notification.ts` (nuevo)
- `frontend/src/pages/DriverDashboard.tsx` (toast)

---

## 2.8 Mejoras de UX

### H-64: Internacionalización (i18n)

**Historia**: Como usuario, quiero poder cambiar el idioma de la plataforma (español/inglés), para usarla en mi idioma preferido.

**Implementación**:

- **Librería**: `react-i18next` + `i18next`.
- **Estructura**: `frontend/src/i18n/locales/{es,en}.json` (~500 keys cada uno).
- **Selector de idioma** en el header (junto al perfil). Persistencia en localStorage.
- **Traducir**: navegación, formularios, estados del ride, errores, dashboard admin.

**Aspectos a considerar**:
- Traducir primero UI principal, luego mensajes de error.
- Usar `t()` en lugar de strings hardcodeados.
- Textos dinámicos con `t('key', { count })`.

**Archivos afectados**:
- `frontend/src/i18n/index.ts` (nuevo)
- `frontend/src/i18n/locales/es.json`, `en.json` (nuevos)
- `frontend/src/components/Header.tsx` (selector)
- Todos los componentes (reemplazar textos)

---

### H-65: Accesibilidad WCAG 2.1 AA

**Historia**: Como usuario con discapacidad visual, quiero que la plataforma sea accesible (WCAG 2.1 AA).

**Implementación**:

- **Contraste**: Verificar ratio 4.5:1 mínimo. Ajustar `#64748B` (text-muted) si no cumple.
- **Navegación teclado**: Tab lógico, skip link, sin trampas de foco.
- **ARIA labels**: Botones, inputs, modales, estados dinámicos (`aria-live`).
- **Textos alternativos**: `alt` descriptivo en imágenes, `aria-hidden` en iconos decorativos.
- **Pruebas**: axe DevTools, lector de pantalla (NVDA, VoiceOver).

**Aspectos a considerar**:
- Cambios incrementales — priorizar contraste y navegación teclado primero.
- El color `#64748B` sobre blanco da ~4.1:1 — considerar `#475569` para cumplir AA.

**Archivos afectados**:
- Todos los componentes frontend (revisión progresiva)
- `frontend/src/styles/index.css` (skip-link, focus styles)
- `frontend/src/components/Layout.tsx` (landmarks)

---

### H-66: PWA offline parcial

**Historia**: Como usuario, quiero que la aplicación funcione offline parcialmente (PWA), para consultar mis pedidos sin conexión.

**Implementación**:

- **Plugin**: `vite-plugin-pwa` para generar service worker y manifest.
- **Estrategia de cache**: Pre-cache (assets), Cache-first (datos GET de rides), Network-first (escrituras).
- **Offline queue**: IndexedDB via `idb` para rides creados sin conexión. Sincronizar con Background Sync API.
- **Manifest**: `{ name, short_name, icons, theme_color: #0D9488, display: standalone }`
- **Pantalla offline**: Componente que muestra datos cacheados + botón "Reintentar".

**Aspectos a considerar**:
- PWA requiere HTTPS (localhost funciona).
- Service worker solo en producción (interfiere con HMR en desarrollo).
- Funcionalidad offline parcial — core (chat, tracking) requiere conexión.

**Archivos afectados**:
- `frontend/vite.config.ts` (agregar plugin)
- `frontend/src/pwa/sw.ts` (nuevo)
- `frontend/src/components/OfflineIndicator.tsx` (nuevo)
- `frontend/src/services/offlineQueue.ts` (nuevo)
- `frontend/package.json` (`vite-plugin-pwa`, `idb`)

---

## 2.9 Operaciones y Mantenimiento

### H-67: Backups automáticos de MongoDB

**Historia**: Como admin, quiero tener backups automáticos de MongoDB, para recuperar datos en caso de desastre.

**Implementación**:

- **Script**: `mongodump --uri="$DATABASE_URL" --gzip --archive="/backups/acarreos-$(date +%Y%m%d).gz"`
- **Programación**: Docker sidecar o cron en el servidor. Backup diario.
- **Retención**: 30 días diarios, 6 meses semanales, 1 año mensual.
- **Cifrado**: GPG con AES256 antes de subir a cloud storage (S3/GCS).
- **Restauración**: Script `restore.sh` con lista de backups disponibles.

**Aspectos a considerar**:
- Probar restauración periódicamente.
- En Docker, backup a volumen montado.
- Monitorear éxito/fallo y notificar al admin.

**Archivos afectados**:
- `backend/scripts/backup.sh` (nuevo)
- `backend/scripts/restore.sh` (nuevo)
- `docker-compose.yml` (servicio backup o instrucciones)

---

### H-68: Dashboard de monitoreo

**Historia**: Como admin, quiero tener un dashboard de monitoreo con métricas (rendimiento, errores, usuarios activos), para detectar problemas proactivamente.

**Implementación**:

- **Métricas backend**: Endpoint `GET /api/admin/metrics` retorna latencia por endpoint, tasa error 5xx/4xx, requests/min, usuarios activos (WebSocket), CPU/memoria.
- **Middleware de métricas**: Mide duración por request, almacena en Redis con TTL.
- **Frontend**: Dashboard admin con gráficos (Chart.js o Recharts). Cards con KPIs principales.
- **Alertas**: Thresholds configurables (ej: error rate > 5%) -> notificación al admin.

**Aspectos a considerar**:
- No almacenar métricas en MongoDB (demasiadas escrituras) — usar Redis.
- TTL de métricas: 1 hora para tiempo real, agregaciones diarias en MongoDB.
- Gráficos con intervalos: última hora, último día, última semana.

**Archivos afectados**:
- `backend/src/middleware/metrics.ts` (nuevo)
- `backend/src/routes/admin.ts` (endpoint metrics)
- `frontend/src/pages/admin/MonitoringDashboard.tsx` (nuevo)
- `backend/package.json` (`chart.js` o similar)

---

### H-69: Sistema de feature flags

**Historia**: Como admin, quiero tener un sistema de feature flags, para activar/desactivar funcionalidades sin desplegar.

**Implementación**:

- **Modelo `FeatureFlag`**: `{ name, enabled, description, percentage, createdAt, updatedAt }`
- **Backend**: Middleware que verifica flags antes de ejecutar handlers. API CRUD para admin.
- **Frontend**: Hook `useFeatureFlag('flagName')` que retorna boolean. Componente `<FeatureFlag name="...">`.
- **Porcentaje de usuarios**: `Math.random() < 0.5` para rollout gradual.
- **Flags sugeridas**: `mcp-enabled`, `tracking-realtime`, `payouts-automatic`, `push-notifications`, `new-chat-ui`.

**Aspectos a considerar**:
- Cachear flags en memoria o Redis (no consultar MongoDB en cada request).
- Las flags deben tener valores por defecto (false para nuevas features).
- Interfaz admin: tabla con toggle switches.

**Archivos afectados**:
- `backend/src/models/featureFlag.ts` (nuevo)
- `backend/src/middleware/featureFlag.ts` (nuevo)
- `backend/src/routes/admin.ts` (CRUD flags)
- `frontend/src/hooks/useFeatureFlag.ts` (nuevo)
- `frontend/src/pages/admin/FeatureFlagsPage.tsx` (nuevo)

---

### H-70: Migraciones de base de datos versionadas

**Historia**: Como equipo de desarrollo, quiero tener migraciones de base de datos versionadas, para evolucionar el schema sin downtime.

**Implementación**:

- **Librería**: `migrate-mongo` o sistema custom simple. Bun no tiene ORM con migraciones nativas.
- **Estructura**: `backend/migrations/` con archivos `{timestamp}-{description}.ts`
- **Comandos**: `bun run migrate:up`, `bun run migrate:down`, `bun run migrate:create`
- **Estado**: Tabla `migrations` en MongoDB con `{ filename, appliedAt }`
- **Ejemplo**: `20260625-add-refunded-status.ts` -> agrega estado `refunded` al enum de ride.

**Aspectos a considerar**:
- Las migraciones deben ser idempotentes (pueden ejecutarse varias veces).
- `down` debe revertir exactamente lo que `up` hizo.
- Ejecutar migraciones automáticamente al iniciar el servidor (antes de aceptar requests).
- Para cambios grandes (ej: renombrar campo), considerar migración en dos fases.

**Archivos afectados**:
- `backend/migrations/` (nueva carpeta)
- `backend/src/db/migrate.ts` (nuevo, runner de migraciones)
- `backend/src/index.ts` (ejecutar migraciones al iniciar)
- `backend/package.json` (scripts `migrate:up`, `migrate:down`)

---

## 2.10 Datos y Reportes

### H-71: Exportación CSV de rides, usuarios y pagos

**Historia**: Como admin, quiero exportar reportes CSV de rides, usuarios y pagos, para analizar los datos externamente.

**Implementación**:

- **Endpoint genérico**: `GET /api/admin/export/:entity` con filtros por fecha, estado, rol.
- **Entitys**: `rides`, `users`, `payments`, `drivers`.
- **Streaming**: Para datasets grandes, usar streaming (no cargar todo en memoria). Bun soporta streaming nativo.
- **Cabeceras**: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="rides-2026-06.csv"`
- **Columnas por entidad**:
  - **Rides**: ID, cliente, conductor, tipo, estado, precio, pickup, dropoff, fechas
  - **Usuarios**: ID, nombre, email, rol, estado, fecha registro
  - **Pagos**: ID ride, monto, comisión, neto conductor, estado Stripe, fecha

- **Frontend**: Botones "Exportar CSV" en cada sección del admin con selector de período.

**Aspectos a considerar**:
- Usar `csv-stringify` o generar manualmente (escapar commas y quotes).
- Límite de 100k filas por exportación (notificar si excede).
- Las exportaciones son async para datasets grandes — generar y enviar por email.

**Archivos afectados**:
- `backend/src/routes/admin.ts` (endpoints export)
- `backend/src/services/exporter.ts` (nuevo)
- `frontend/src/components/admin/ExportButton.tsx` (nuevo)
- `backend/package.json` (`csv-stringify` o similar)

---

### H-72: Resumen semanal de ganancias para conductor

**Historia**: Como conductor, quiero ver un resumen semanal de mis ganancias en el dashboard, para planificar mis finanzas.

**Implementación**:

- **Endpoint**: `GET /api/users/driver/me/weekly-summary` -> `{ totalEarned, totalRides, averagePerRide, dailyBreakdown: [{ date, rides, earned }] }`
- **Frontend**: Card en el dashboard del conductor con gráfico de barras (ganancias por día).
- **Comparación**: vs semana anterior (porcentaje de cambio).
- **Período**: Lunes a domingo (semana actual). Selector para ver semanas anteriores.

**Aspectos a considerar**:
- Los datos vienen de rides `paid` del conductor.
- Gráfico simple con Recharts o Chart.js.
- Mostrar el neto (driverAmount = 90% del finalPrice).

**Archivos afectados**:
- `backend/src/routes/users.ts` (endpoint weekly-summary)
- `frontend/src/pages/DriverDashboard.tsx` (integrar resumen)
- `frontend/src/components/WeeklyEarningsChart.tsx` (nuevo)

---

## Orden de Implementación Recomendado

### Fase 1 — Fundación (Sprint 1-2)
| Orden | Historia | Depende de | Esfuerzo |
|-------|----------|------------|----------|
| 1 | **H-41** Validación Zod | Nada (complementar lo existente) | Media |
| 2 | **H-39** Logging estructurado | Nada | Baja |
| 3 | **H-40** Rate limiting | Redis disponible (H-35) | Media |
| 4 | **H-35** Dockerización | Nada | Alta |
| 5 | **H-36** CI/CD | H-37 | Media |
| 6 | **H-37** Tests unitarios/integración | H-41 | Alta |
| 7 | **H-70** Migraciones DB | Nada | Baja |

### Fase 2 — Tracking y Mapas (Sprint 3-4)
| Orden | Historia | Depende de | Esfuerzo |
|-------|----------|------------|----------|
| 8 | **H-46** Mapa en detalles ride | Nada (reutiliza AddressInput) | Media |
| 9 | **H-45** Compartir ubicación (driver) | Redis, WebSocket existente | Alta |
| 10 | **H-44** Tracking en tiempo real (cliente) | H-45 | Alta |

### Fase 3 — Pagos Avanzados (Sprint 5-6)
| Orden | Historia | Depende de | Esfuerzo |
|-------|----------|------------|----------|
| 11 | **H-47** Payouts Stripe Connect | Stripe existente | Alta |
| 12 | **H-48** Facturas PDF | H-51 (email) | Media |
| 13 | **H-49** Conciliación pagos | Stripe existente | Media |
| 14 | **H-50** Reembolsos y disputas | Stripe existente | Alta |

### Fase 4 — Notificaciones (Sprint 7-8)
| Orden | Historia | Depende de | Esfuerzo |
|-------|----------|------------|----------|
| 15 | **H-51** Notificaciones email | Nada (servicio nuevo) | Media |
| 16 | **H-52** Notificaciones push | H-66 (PWA) | Alta |
| 17 | **H-53** Nuevos pedidos a drivers | WebSocket existente | Media |

### Fase 5 — UX y Calidad (Sprint 9-10)
| Orden | Historia | Depende de | Esfuerzo |
|-------|----------|------------|----------|
| 18 | **H-64** i18n español/inglés | Nada | Alta |
| 19 | **H-65** Accesibilidad WCAG | Nada | Alta (transversal) |
| 20 | **H-66** PWA offline | Nada | Alta |
| 21 | **H-42** Auditoría | H-41 | Media |

### Fase 6 — Admin y Operaciones (Sprint 11-12)
| Orden | Historia | Depende de | Esfuerzo |
|-------|----------|------------|----------|
| 22 | **H-38** Tests E2E Playwright | H-37, H-36 | Alta |
| 23 | **H-43** GDPR/Privacidad | H-41 | Media |
| 24 | **H-67** Backups MongoDB | H-35 | Media |
| 25 | **H-68** Dashboard monitoreo | H-39, H-40 | Alta |
| 26 | **H-69** Feature flags | Nada | Media |
| 27 | **H-71** Exportación CSV | Nada | Baja |
| 28 | **H-72** Resumen semanal conductor | Nada | Baja |

---

---

## Segmentación Full-Stack para 2 Desarrolladores

### Premisa

Ambos desarrolladores son **full-stack** y cada uno es responsable del **backend + frontend completo** de sus historias asignadas. No hay división por capas — cada historia es ownership completo.

### Criterios de asignación

| Criterio | Dev A | Dev B |
|----------|-------|-------|
| **Cluster** | Infraestructura + Tracking + Notificaciones + Operaciones | Seguridad + Pagos + UX + Admin + Calidad |
| **Backend** | Bun/Hono, MongoDB, Redis, WebSocket, Docker, Stripe Connect | Bun/Hono, MongoDB, Stripe API, Zod, Servicios email/push |
| **Frontend** | Leaflet/OSRM, mapas, WebSocket cliente, dashboards monitoreo | i18n, PWA, accesibilidad, Playwright, gráficos Recharts |
| **Independencia** | Mínimas dependencias con Dev B | Mínimas dependencias con Dev A |

### Distribución por Fases

Ambos trabajan en **sprints paralelos**. Cada fase = 2 sprints de 2 semanas.

---

### Fase 1 — Fundación (Sprints 1-2)

**Dev A — Infraestructura y DevOps** (3 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-35** Dockerización | Dockerfile Bun multi-stage, docker-compose.yml | Dockerfile Nginx, manifest PWA |
| **H-36** CI/CD | Workflows GitHub Actions (lint, typecheck, test, build, deploy) | Integración frontend en CI |
| **H-70** Migraciones DB | Sistema migrate-mongo, scripts up/down, auto-ejecución al iniciar | — |

**Dev B — Seguridad base** (2 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-41** Validación Zod | Schemas para TODOS los endpoints + middleware validate genérico | Mensajes de error claros en formularios |
| **H-39** Logging | Logger pino + middleware x-request-id + levels por ambiente | — |

**Checkpoint S2**: Ambos Dockerfiles funcionando, CI pipeline, validaciones activas en toda la API, logging estructurado.

---

### Fase 2 — Tracking y Mapas (Sprints 3-4)

**Dev A — Tracking en tiempo real** (3 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-45** Ubicación driver | WS `driver:location-update`, Redis con TTL, endpoint `POST /:id/location` | Hook `useDriverLocation` (watchPosition), toggle compartir |
| **H-44** Tracking cliente | Endpoint `GET /:id/tracking`, broadcast WS `tracking:{rideId}` | Componente LiveTrackingMap (marcador móvil + ETA) |
| **H-46** Mapa ride | Cálculo de ruta via OSRM (helper backend) | Componente RouteMap (Leaflet, 2 marcadores, polilínea, distancia) |

**Dev B — Pagos Avanzados** (2 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-47** Payouts Stripe Connect | Onboarding Express, transferencias, cron semanal, modelo Payout | Página DriverOnboarding (redirige a Stripe), historial payouts |
| **H-50** Reembolsos y disputas | Endpoint refund, webhook dispute, modelo Dispute | Panel admin reembolsos + disputas con deadline countdown |

**Checkpoint S4**: Mapa funcional en ride details. Conductor comparte ubicación. Cliente ve tracking en vivo. Payouts semanales operativos. Admin puede reembolsar.

---

### Fase 3 — Pagos UX + Resto (Sprints 5-6)

**Dev A — Facturación y Conciliación** (2 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-48** Facturas | PDF con pdfkit, endpoint `GET /:rideId/invoice`, envío email automático | Link descarga en RideDetails + historial facturas |
| **H-49** Conciliación | Endpoint `GET /api/admin/payments/reconciliation` | Tabla con filtros, color coding, export CSV |

**Dev B — UX Global** (2 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-64** i18n | — (todo frontend) | react-i18next, traducciones ES/EN (~500 keys), selector en header |
| **H-65** Accesibilidad WCAG | — (todo frontend) | Contraste 4.5:1, navegación teclado, ARIA labels, skip-link, axe DevTools |

**Checkpoint S6**: Facturas descargables. Conciliación funcional. App traducida ES/EN. Accesibilidad AA.

---

### Fase 4 — Notificaciones (Sprints 7-8)

**Dev A — Email + Nuevos Pedidos** (2 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-51** Email | Servicio con Resend, templates HTML, orquestador por evento de ride | Preferencias de notificaciones en perfil |
| **H-53** Nuevos pedidos drivers | Broadcast WS `driver:new-rides`, persistencia en MongoDB, filtro por cercanía | Toast notification + sonido en DriverDashboard, lista notificaciones |

**Dev B — Push + PWA** (2 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-66** PWA offline | — (todo frontend) | vite-plugin-pwa, service worker, manifest, offline queue (IndexedDB) |
| **H-52** Push notifications | Endpoint suscripción, servicio envío push con web-push | Hook `usePushNotifications`, service worker push handler |

**Checkpoint S8**: Emails transaccionales funcionando. Conductores reciben alerts de nuevos pedidos. PWA instalable con offline parcial. Push notifications operativas.

---

### Fase 5 — Calidad y Cumplimiento (Sprints 9-10)

**Dev A — Auditoría + Backups + Monitoreo** (3 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-42** Auditoría | Modelo AuditLog, helper `logAudit`, integración en rutas críticas | — |
| **H-67** Backups | Script backup/restore, Docker sidecar, cifrado GPG, cleanup retención | — |
| **H-68** Monitoreo | Middleware métricas, endpoint `GET /api/admin/metrics`, almacenamiento Redis | Dashboard admin con gráficos Recharts, cards KPIs, alertas visuales |

**Dev B — GDPR + Feature Flags + Reportes** (3 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-43** GDPR | Endpoints export-data y delete-account, anonimización, purge 30 días | Página PrivacyPolicy, AccountSettings (exportar/eliminar), consentimiento registro |
| **H-69** Feature flags | Modelo + middleware + API CRUD | Hook `useFeatureFlag`, admin page con toggle switches |
| **H-72** Resumen conductor | Endpoint `GET /api/users/driver/me/weekly-summary` | Componente WeeklyEarningsChart + gráfico de barras en dashboard |

**Checkpoint S10**: Auditoría activa. Backups automáticos. Monitoreo en tiempo real. GDPR compliance. Feature flags operativas.

---

### Fase 6 — Finalización (Sprints 11-12)

**Dev A — Exportación CSV + Rate Limiting + Tests** (3 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-71** Export CSV | Endpoint streaming `GET /api/admin/export/:entity` con csv-stringify | Botón ExportButton en cada sección admin con selector de período |
| **H-40** Rate limiting | @hono/rate-limiter + Redis, límites por endpoint y por usuario | Mensaje 429 amigable |
| **H-37** Tests BE | Tests unitarios e integración backend (auth, rides, messages, payments, admin) | Tests de integración con mongodb-memory-server |

**Dev B — E2E + Tests Frontend + Pendientes** (2 historias completas)

| Historia | Backend | Frontend |
|----------|---------|----------|
| **H-38** E2E Playwright | — | 7 flujos críticos: registro->crear->chatear->tracking->pagar->calificar, registro conductor, admin |
| **H-37** Tests FE | — | Setup de tests frontend, mocks de API, tests de componentes clave |

**Checkpoint S12**: Exportación CSV funcional. Rate limiting activo. Tests backend pasando. Tests E2E en CI. Cobertura >70% en módulos críticos.

---

### Resumen de asignación

| Dev | Cluster | Historias | Esfuerzo estimado |
|-----|---------|-----------|-------------------|
| **Dev A** | Infra + Tracking + Email + Ops | H-35, H-36, H-44, H-45, H-46, H-48, H-49, H-51, H-53, H-42, H-67, H-68, H-71, H-40, H-70 | **15 historias** (~50%) |
| **Dev B** | Seguridad + Pagos + UX + Admin | H-41, H-39, H-47, H-50, H-64, H-65, H-66, H-52, H-43, H-69, H-72, H-38, H-37 | **13 historias** (~50%) |

### Dependencias entre tracks (resolver con coordinación)

| Dependencia | Afecta | Tipo | Mitigación |
|-------------|--------|------|------------|
| H-48 (factura) necesita H-51 (email) | Dev A ambas | Interna del track | H-51 se completa en S7, H-48 en S5-6. La generación PDF no necesita email — el envío se agrega después |
| H-52 (push) necesita H-66 (PWA) | Dev B ambas | Interna del track | H-66 se completa en S7, H-52 en S8. Orden natural |
| H-39 (logging) y H-40 (rate limit) comparten middleware | Diferentes tracks | Baja | Definir logger middleware primero (Dev B, S1-2). Dev A lo consume en S11-12 |
| H-37 (tests) compartido | Ambos | Media | Cada dev escribe tests de sus módulos. Coordinar setup de mongodb-memory-server |

### Principios

1. **Ownership total**: Cada dev hace backend + frontend de cada historia asignada.
2. **Independencia máxima**: Los tracks están diseñados para minimizar blockers. Solo 4 dependencias menores identificadas.
3. **API contracts estables**: Si un dev necesita un endpoint del otro track, se acuerda el contrato (método, path, schema) y cada uno implementa su lado.
4. **Checkpoints cada 2 sprints**: Integración de ambos tracks + code review cruzado.
5. **Tests por cada historia**: Cada dev escribe tests (unitarios + integración) de sus propias historias, no al final.

---

**Total: 28 historias | 6 fases (12 sprints) | 2 devs full-stack en paralelo | Estimado: ~6 meses**
