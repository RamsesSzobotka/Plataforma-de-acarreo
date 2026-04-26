# PRD-Plataforma de acarreso

Documento orientado a ejecucion por IA y equipos fullstack.

## 0. Contrato de Implementacion para IA

### 0.1 Objetivo Operativo
Una IA debe poder construir el producto de extremo a extremo usando este documento como fuente principal, sin ambiguedad funcional ni tecnica.

### 0.2 Restricciones Obligatorias
- Mantener stack definido: React + Vite, Bun + Honor, MongoDB, Clare SSO, Stripe.
- No reemplazar tecnologias base sin aprobacion explicita.
- Implementar todos los modulos en vertical slice (backend + frontend) por historia.
- No romper contratos existentes: usar versionado o capa de compatibilidad.

### 0.3 Artefactos Minimos que Debe Producir la IA
- API REST versionada (/api/v1) con seguridad y validaciones.
- Portales funcionales: cliente, conductor y admin.
- Integracion SSO + Stripe webhook seguro.
- Paginacion, filtros y busqueda en listados principales.
- Pruebas minimas por modulo (caso feliz + caso negativo).

### 0.4 Criterio Global de Completitud
El proyecto se considera completo solo si los 3 portales funcionan con backend real, pagos confirmados por webhook, control RBAC/ownership activo y modulo admin operativo con auditoria.

## 1. Vision General

### 1.1 Proposito
Construir una plataforma C2C de acarreos on-demand, tipo marketplace, que conecte clientes con conductores para mover carga de forma segura, trazable y con pago digital integrado.

### 1.2 Objetivos de Negocio
- Permitir solicitud y ejecucion de acarreos entre particulares.
- Garantizar pagos seguros mediante Stripe.
- Proveer experiencia diferenciada por rol: cliente, conductor y administrador.
- Escalar operacion con buenas practicas de seguridad, observabilidad y rendimiento.

### 1.3 Stack Tecnologico (se mantiene)

Frontend
- React
- Vite

Backend
- Bun
- Honor

Base de datos
- MongoDB

Servicios externos
- Autenticacion: Clare (SDK) con SSO (OIDC/SAML)
- Pasarela de pago: Stripe

## 2. Alcance del Producto

### 2.1 Portales
- Portal Cliente: crear solicitudes, ver estado del viaje, historial y pagos.
- Portal Conductor: disponibilidad, aceptacion de servicios, tracking y cierre.
- Back Office Admin: gestion integral de usuarios, conductores, viajes, pagos, tarifas y monitoreo operativo.

### 2.2 Funcionalidades Core
- Registro y acceso por SSO.
- Matching geoespacial de conductores.
- Flujo de viaje completo (requested -> accepted -> in_progress -> completed -> paid/cancelled).
- Cobro con Stripe y confirmacion via webhook.
- Calificacion mutua cliente-conductor.
- Monitoreo administrativo y acciones de moderacion.

### 2.3 Modulos Obligatorios a Construir (Checklist IA)
- M01 Auth SSO (Clare): login federado, callback, sesion, perfil autenticado.
- M02 Usuarios y Roles: perfil, estados, RBAC y ownership.
- M03 Portal Cliente: crear ride, seguimiento, historial paginado, pago.
- M04 Portal Conductor: disponibilidad, aceptar ride, actualizar estados, historial.
- M05 Rides Engine: ciclo de vida de ride, matching, reglas de estado.
- M06 Pagos Stripe: PaymentIntent, confirmacion, webhook idempotente.
- M07 WebSockets: eventos de ride y ubicacion en tiempo real.
- M08 Back Office Admin: dashboard, gestion users/drivers/rides/payments, tarifas.
- M09 Auditoria Admin: bitacora de acciones criticas y trazabilidad.
- M10 Optimizacion: paginacion, filtros, indices, cache basico.

## 3. Arquitectura General

### 3.1 Arquitectura de Alto Nivel
React + Vite
-> HTTPS (REST + WebSocket)
Bun + Honor
-> MongoDB

Integraciones externas:
- Clare (Auth)
- Stripe (Pagos)

### 3.2 Principios Arquitectonicos
- Modularidad por dominio.
- Separacion de responsabilidades (Routes, Controllers, Services, Repositories).
- Seguridad por defecto (auth, RBAC, ownership checks).
- Trazabilidad end-to-end (logs, eventos de dominio, auditoria admin).

### 3.3 Estructura Base Backend
src/
 ├── config/
 │    ├── env.ts
 │    ├── db.ts
 │    └── stripe.ts
 ├── modules/
 │    ├── auth/
 │    ├── users/
 │    ├── drivers/
 │    ├── rides/
 │    ├── payments/
 │    ├── ratings/
 │    └── admin/
 ├── middlewares/
 │    ├── auth.middleware.ts
 │    ├── role.middleware.ts
 │    ├── ownership.middleware.ts
 │    ├── pagination.middleware.ts
 │    └── error.middleware.ts
 ├── routes/
 ├── services/
 ├── repositories/
 ├── sockets/
 ├── utils/
 └── server.ts

## 4. Modelo de Datos (MongoDB)

### 4.1 Users
{
  "_id": "ObjectId",
  "clareUserId": "string",
  "role": "client | driver | admin",
  "name": "string",
  "email": "string",
  "phone": "string",
  "status": "active | suspended",
  "lastLoginAt": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}

Indices recomendados:
- { clareUserId: 1 } unique
- { email: 1 } unique
- { role: 1, status: 1 }

### 4.2 Drivers
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "vehicleType": "string",
  "plate": "string",
  "capacityKg": "number",
  "isAvailable": "boolean",
  "currentLocation": {
    "type": "Point",
    "coordinates": [lng, lat]
  },
  "rating": "number",
  "completedRides": "number",
  "createdAt": "Date",
  "updatedAt": "Date"
}

Indices recomendados:
- { userId: 1 } unique
- { plate: 1 } unique
- { currentLocation: "2dsphere" }
- { isAvailable: 1, rating: -1 }

### 4.3 Rides
{
  "_id": "ObjectId",
  "clientId": "ObjectId",
  "driverId": "ObjectId | null",
  "pickupLocation": {
    "type": "Point",
    "coordinates": [lng, lat]
  },
  "dropoffLocation": {
    "type": "Point",
    "coordinates": [lng, lat]
  },
  "status": "requested | accepted | in_progress | completed | cancelled | paid",
  "estimatedPrice": "number",
  "finalPrice": "number",
  "currency": "string",
  "distanceKm": "number",
  "paymentIntentId": "string",
  "requestedAt": "Date",
  "acceptedAt": "Date | null",
  "completedAt": "Date | null",
  "createdAt": "Date",
  "updatedAt": "Date"
}

Indices recomendados:
- { clientId: 1, createdAt: -1 }
- { driverId: 1, createdAt: -1 }
- { status: 1, createdAt: -1 }
- { createdAt: -1 }

### 4.4 Payments
{
  "_id": "ObjectId",
  "rideId": "ObjectId",
  "stripePaymentIntentId": "string",
  "amount": "number",
  "currency": "string",
  "status": "requires_payment | paid | failed | refunded",
  "paidAt": "Date | null",
  "createdAt": "Date",
  "updatedAt": "Date"
}

Indices recomendados:
- { rideId: 1 } unique
- { stripePaymentIntentId: 1 } unique
- { status: 1, createdAt: -1 }

### 4.5 AdminAuditLogs
{
  "_id": "ObjectId",
  "adminUserId": "ObjectId",
  "action": "string",
  "resource": "users | drivers | rides | payments | settings",
  "resourceId": "ObjectId | string",
  "before": {},
  "after": {},
  "createdAt": "Date"
}

Indice recomendado:
- { resource: 1, createdAt: -1 }

## 5. Autenticacion y Autorizacion

### 5.1 Autenticacion con Clare (SSO)
Flujo:
1. Usuario inicia sesion desde frontend.
2. Frontend redirige al Identity Provider (IdP) via Clare SSO.
3. El IdP autentica al usuario y devuelve codigo/autorizacion.
4. Backend valida token (id_token/access_token) con SDK Clare.
5. Backend crea/sincroniza usuario en MongoDB.
6. Backend adjunta contexto de usuario autenticado.

Formato de token:
- Header: Authorization: Bearer <token>

### 5.2 RBAC por Roles
Roles permitidos:
- client
- driver
- admin

Reglas minimas:
- Solo client puede crear rides.
- Solo driver puede aceptar rides.
- Solo admin puede suspender usuarios y modificar configuraciones globales.
- Todo acceso a recursos de usuario requiere validacion de ownership.

### 5.3 Ownership y Anti-IDOR
Toda operacion de lectura/escritura sobre entidad sensible valida que:
- entidad.userId == req.user.id, o
- req.user.role == admin

## 6. Seguridad de Plataforma

### 6.1 Seguridad de Endpoints
Publicos:
- GET /auth/sso/redirect
- GET /auth/sso/callback
- POST /stripe/webhook

Protegidos:
- GET /me
- POST /rides
- POST /rides/:id/accept
- GET /admin/users

Requisitos comunes:
- Token valido
- Usuario activo
- Rol autorizado
- Validacion de ownership segun corresponda

### 6.2 Seguridad en Stripe
Webhook seguro:
- Endpoint: POST /stripe/webhook
- Validar firma con STRIPE_WEBHOOK_SECRET
- Usar idempotencia por event.id
- No confiar en el frontend para marcar pagos
- Confirmar estado paid solo con evento oficial de Stripe

### 6.3 Hardening Basico
- Validacion estricta de inputs (DTO/schema por endpoint).
- Sanitizacion de payloads en entrada.
- Rate limiting en endpoints de SSO/callback, creacion de rides y endpoints admin sensibles.
- Manejo de errores sin stack trace en produccion.
- Headers de seguridad y CORS restringido por entorno.

## 7. Flujos Funcionales

### 7.1 Flujo de Ride
1. Cliente crea solicitud.
2. Sistema estima precio y busca conductores cercanos.
3. Conductor acepta.
4. Viaje pasa a in_progress.
5. Conductor finaliza.
6. Se confirma pago.
7. Viaje cambia a paid.

### 7.2 Flujo de Pago
1. Backend calcula costo (tarifa base + distancia + ajustes).
2. Backend crea PaymentIntent en Stripe.
3. Frontend confirma pago.
4. Stripe notifica por webhook.
5. Backend actualiza payment y ride de forma atomica.

## 8. Tiempo Real (WebSocket)

Casos de uso:
- Disponibilidad de conductores.
- Actualizacion de ubicacion.
- Notificacion de nuevas solicitudes.
- Actualizacion de estado del viaje.

Eventos:
- driver:location:update
- ride:new_request
- ride:accepted
- ride:status_update

Normas:
- Validar token antes de aceptar conexion.
- Asociar socket con userId y role.
- Rate limit por canal de ubicacion.

## 9. Frontend

### 9.1 Estructura Base
src/
 ├── api/
 ├── components/
 ├── hooks/
 ├── layouts/
 ├── pages/
 │    ├── client/
 │    ├── driver/
 │    └── admin/
 ├── routes/
 ├── store/
 └── utils/

### 9.2 Reglas de UI por Rol
- Rutas protegidas por autenticacion y rol.
- Layout y menu desacoplado por portal.
- Manejo centralizado de errores de API.

## 10. Back Office (Admin)

### 10.1 Modulos Administrativos
- Dashboard: metricas operativas y financieras.
- Usuarios: listar, filtrar, suspender/reactivar.
- Conductores: validacion, disponibilidad, rendimiento.
- Viajes: seguimiento, cancelaciones, incidencias.
- Pagos: estado, conciliacion, reintentos.
- Tarifas: configuracion de tarifa base y reglas.
- Auditoria: historial de cambios administrativos.

### 10.2 Controles de Seguridad Admin
- Acceso exclusivo rol admin.
- 100% endpoints protegidos con auth + RBAC.
- Registro de auditoria en acciones criticas.

## 11. Optimizacion y Escalabilidad

### 11.1 Paginacion Estandar
Aplicar en listados de usuarios, conductores, rides, pagos, logs.

Contrato recomendado:
- Query params: page, limit, sortBy, sortOrder, search, status
- Valores por defecto: page=1, limit=20
- Limite maximo: limit=100

Respuesta estandar:
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 350,
    "totalPages": 18,
    "hasNext": true,
    "hasPrev": false
  }
}

### 11.2 Filtros, Orden y Busqueda
- Filtros por rol, estado, fecha, rango de monto, ciudad/zona.
- Orden por createdAt, rating, amount.
- Busqueda por email, nombre, placa, id de ride.

### 11.3 Rendimiento de Base de Datos
- Indices compuestos para listados frecuentes.
- Proyecciones selectivas (evitar overfetch).
- Paginacion por cursor en tablas de alto volumen (opcional fase avanzada).
- TTL para datos temporales no criticos (tokens de sesion, eventos efimeros).

### 11.4 Caching y Carga
- Cache de lectura para catalogos y configuraciones.
- Debounce/throttle en tracking de ubicacion.
- Compresion HTTP y respuestas ligeras.

### 11.5 Resiliencia Operativa
- Reintentos controlados para integraciones externas.
- Idempotencia en operaciones de cobro y webhooks.
- Colas/eventos para tareas no criticas (notificaciones, reportes).

## 12. API Guidelines

### 12.1 Convenciones
- Versionado: /api/v1
- Respuesta uniforme: data, meta, error
- HTTP status coherentes (200, 201, 400, 401, 403, 404, 409, 422, 500)

### 12.2 Endpoints Clave
Cliente:
- POST /api/v1/rides
- GET /api/v1/rides?page=1&limit=20
- GET /api/v1/rides/:id

Conductor:
- POST /api/v1/rides/:id/accept
- PATCH /api/v1/rides/:id/status
- GET /api/v1/driver/rides?page=1&limit=20

Admin:
- GET /api/v1/admin/users?page=1&limit=20&status=active
- PATCH /api/v1/admin/users/:id/suspend
- GET /api/v1/admin/rides?page=1&limit=20&status=completed
- GET /api/v1/admin/payments?page=1&limit=20&status=paid

### 12.3 Reglas de Contrato API para IA
- Todas las listas devuelven data + meta con paginacion estandar.
- Los errores siguen formato uniforme: { error: { code, message, details? } }.
- Ningun endpoint protegido responde sin validar token, estado de usuario y rol.
- Endpoints de escritura deben validar payload y ownership cuando aplique.

## 13. Variables de Entorno
- CLARE_SECRET
- CLARE_SSO_CLIENT_ID
- CLARE_SSO_CLIENT_SECRET
- CLARE_SSO_REDIRECT_URI
- CLARE_SSO_PROVIDER
- STRIPE_SECRET
- STRIPE_WEBHOOK_SECRET
- MONGODB_URI
- APP_ENV
- PORT

## 14. Roadmap Tecnico

Fase 1 - Fundacion
- Setup Bun + Honor
- Conexion MongoDB
- Integracion Clare SSO
- Integracion Stripe base

Fase 2 - Operacion Core
- CRUD Users y Drivers
- Flujo completo de Rides
- Matching geoespacial
- Paginacion y filtros en listados

Fase 3 - Tiempo Real y Pagos
- WebSockets y tracking en vivo
- Confirmacion de pagos por webhook
- Hardening de seguridad

Fase 4 - Back Office
- Dashboard y modulos admin completos
- Auditoria y reporteria

Fase 5 - Escalado
- Optimizacion de consultas
- Cache y mejoras de rendimiento
- Pruebas integrales (manual + automatizadas)

## 15. Orden de Construccion Recomendado para IA

1. Base tecnica: configuracion de proyecto, env, db, middlewares globales.
2. M01 y M02: SSO, usuarios, roles, auth middleware, ownership middleware.
3. M05 + M03: motor de rides y portal cliente.
4. M04 + M07: portal conductor y realtime.
5. M06: pagos Stripe + webhook + reconciliacion.
6. M08 + M09: back office admin y auditoria.
7. M10: optimizacion final (paginacion fina, filtros, indices, rendimiento).

Regla de dependencia:
- Ningun modulo de portal se cierra sin backend operativo.
- Ningun modulo de backend se considera final sin UI conectada.
- Ningun flujo de pago se aprueba sin validacion por webhook.

## 16. Riesgos y Mitigacion

| Riesgo | Mitigacion |
|---|---|
| Fraude en pagos | Confirmacion solo via webhook firmado |
| Acceso indebido | RBAC + ownership checks en backend |
| Fuerza bruta | Rate limiting + monitoreo de intentos |
| Degradacion por volumen | Indices, paginacion, cache y observabilidad |

## 17. Entregables Finales
- Backend modular seguro con Bun + Honor + MongoDB.
- Portal Cliente funcional.
- Portal Conductor funcional.
- Back Office Admin completo para gestion operativa.
- Integracion Clare (SSO).
- Integracion Stripe con webhook seguro.
- Matching de conductores y tracking en tiempo real.
- Endpoints protegidos, auditables y optimizados con paginacion.

## 18. Criterios de Aceptacion por Modulo (Resumen Ejecutable)
- Auth SSO: login/callback funcional, token valido y usuario sincronizado.
- Cliente: puede crear ride, pagar y ver historial paginado.
- Conductor: puede aceptar ride y actualizar estado en tiempo real.
- Pagos: ride solo pasa a paid con webhook valido de Stripe.
- Admin: puede listar/filtrar/accionar usuarios, rides y pagos con RBAC.
- Seguridad: anti-IDOR, validaciones y rate limiting activos.
- Escalabilidad: indices clave creados, paginacion aplicada y tiempos de respuesta estables.