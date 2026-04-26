# Division de responsabilidades fullstack (2 devs)

Documento operativo para ejecutar el PRD sin conflictos entre dos desarrolladores fullstack.

## 1. Objetivo

Separar el trabajo entre Dev 1 y Dev 2 para construir backend y frontend en paralelo, manteniendo:
- Conectividad entre modulos.
- Contratos API estables.
- Compatibilidad entre cambios.
- Entrega por vertical slices (backend + frontend por historia).

## 2. Reglas obligatorias de colaboracion

- Mantener stack definido en el PRD: React + Vite, Bun + Honor, MongoDB, Clare SSO, Stripe.
- Toda API nueva debe publicarse bajo /api/v1 y con contrato uniforme (data, meta, error).
- No romper endpoints existentes: usar versionado o compatibilidad hacia atras.
- Ningun merge sin validacion de:
  - Auth + RBAC + ownership en endpoints protegidos.
  - Caso feliz y caso negativo del modulo afectado.
  - Integracion frontend-backend funcional del flujo tocado.
- Pull requests pequenos por modulo/historia (evitar PRs gigantes).
- Si ambos tocan el mismo recurso, gana el contrato acordado en este documento.

## 3. Convenciones compartidas (frontera entre devs)

### 3.1 Contrato API comun

- Base path: /api/v1
- Formato exito:
  {
    "data": {},
    "meta": {}
  }
- Formato error:
  {
    "error": {
      "code": "STRING_CODE",
      "message": "Mensaje legible",
      "details": {}
    }
  }

### 3.2 Paginacion comun

- Query params: page, limit, sortBy, sortOrder, search, status
- Defaults: page=1, limit=20
- Maximo: limit=100

### 3.3 Regla de ownership

- Solo propietario o admin puede leer/modificar recursos sensibles.
- Se valida en backend aunque frontend oculte botones.

## 4. Division de responsabilidades

## 4.1 Dev 1 - Plataforma Core, Cliente y Pagos

Responsabilidad principal: base tecnica, autenticacion, ciclo de ride para cliente y pagos Stripe.

### Backend (Dev 1)

- Configuracion base del servidor y entorno:
  - src/config/env.ts, db.ts, stripe.ts
  - src/server.ts y middlewares globales
- M01 Auth SSO (Clare):
  - GET /auth/sso/redirect
  - GET /auth/sso/callback
  - sincronizacion de usuario autenticado
- M02 Usuarios y Roles (base):
  - modelo Users
  - middleware auth + role + ownership
- M03 Portal Cliente (API):
  - POST /api/v1/rides
  - GET /api/v1/rides
  - GET /api/v1/rides/:id
- M05 Rides Engine (parte cliente):
  - creacion de ride
  - transicion requested -> accepted (cuando conductor acepte)
- M06 Pagos Stripe:
  - creacion PaymentIntent
  - POST /stripe/webhook con firma y idempotencia
  - confirmacion de paid solo por webhook
- Pruebas minimas por modulo de su alcance.

### Frontend (Dev 1)

- Base de rutas protegidas por autenticacion.
- Portal Cliente:
  - crear solicitud
  - ver estado del ride
  - historial paginado
  - flujo de pago
- Capa api para modulos cliente/pago con manejo centralizado de errores.

## 4.2 Dev 2 - Conductores, Tiempo Real y Back Office Admin

Responsabilidad principal: dominio de conductor, realtime y administracion operativa.

### Backend (Dev 2)

- M04 Portal Conductor (API):
  - POST /api/v1/rides/:id/accept
  - PATCH /api/v1/rides/:id/status
  - GET /api/v1/driver/rides
- M05 Rides Engine (parte conductor/operacion):
  - reglas de aceptacion por disponibilidad
  - transiciones accepted -> in_progress -> completed/cancelled
- M07 WebSockets:
  - autenticacion de socket
  - driver:location:update
  - ride:new_request, ride:accepted, ride:status_update
- M08 Back Office Admin:
  - endpoints admin users/drivers/rides/payments con filtros y paginacion
- M09 Auditoria Admin:
  - log de acciones criticas (before/after)
- M10 Optimizacion (en su dominio):
  - indices y consultas para conductores/admin
- Pruebas minimas por modulo de su alcance.

### Frontend (Dev 2)

- Portal Conductor:
  - disponibilidad
  - aceptar ride
  - actualizar estado del viaje
  - historial paginado
  - tracking de ubicacion en vivo
- Back Office Admin:
  - dashboard
  - gestion users/drivers/rides/payments
  - filtros, busqueda, paginacion
  - vista de auditoria

## 5. Orden recomendado de ejecucion (sin romper conectividad)

## Fase 0 - Alineacion de contratos (ambos)

- Definir y congelar:
  - DTOs principales (Users, Drivers, Rides, Payments, AdminAuditLogs)
  - contratos API iniciales
  - eventos WebSocket
- Entregable: documento de contratos acordado + coleccion de requests de prueba.

## Fase 1 - Fundacion (lidera Dev 1, apoya Dev 2)

- Setup base backend, MongoDB, env, middlewares, manejo de errores.
- Auth SSO funcional y contexto de usuario autenticado.
- Entregable: login y endpoint /me funcionando.

## Fase 2 - Core de rides paralelo

- Dev 1:
  - creacion de rides + vistas cliente.
- Dev 2:
  - aceptacion/estados de rides + vistas conductor.
- Integracion conjunta:
  - flujo requested -> accepted -> in_progress -> completed.
- Entregable: viaje completo sin pagos.

## Fase 3 - Pagos + realtime paralelo

- Dev 1:
  - PaymentIntent + webhook Stripe idempotente + UI de pago.
- Dev 2:
  - WebSockets y tracking de ubicacion en vivo.
- Integracion conjunta:
  - ride pasa a paid solo tras webhook valido.
- Entregable: flujo end-to-end con pago confirmado y eventos en tiempo real.

## Fase 4 - Admin y auditoria (lidera Dev 2)

- Modulos admin completos + bitacora de auditoria.
- Dev 1 valida consistencia de pagos/reportes con admin.
- Entregable: back office operativo con seguridad RBAC.

## Fase 5 - Optimizacion y cierre (ambos)

- Paginacion/filtros/busqueda en todos los listados.
- Indices clave y mejoras de rendimiento.
- Hardening final y pruebas integrales.
- Entregable: criterios de aceptacion del PRD cumplidos.

## 6. Dependencias y handoffs

- Handoff A (Dev 1 -> Dev 2):
  - auth estable + esquema Users listo.
- Handoff B (Dev 2 -> Dev 1):
  - estados de ride finales para habilitar cobro definitivo.
- Handoff C (Dev 1 -> Dev 2):
  - estado paid confirmado por webhook para panel admin.

## 7. Politica de ramas y merges

- Ramas sugeridas:
  - dev1/m01-auth, dev1/m03-client-rides, dev1/m06-payments
  - dev2/m04-driver, dev2/m07-realtime, dev2/m08-admin
- Regla de merge:
  - primero merge a rama de integracion compartida
  - despues a main con checks verdes
- Prohibido merge directo a main sin revision cruzada entre Dev 1 y Dev 2.

## 8. Matriz resumida de ownership

- Dev 1 owner: auth, users base, rides cliente, pagos, portal cliente.
- Dev 2 owner: drivers, estado operativo de rides, websockets, admin, auditoria, portal conductor.
- Compartido: contratos API, seguridad global, paginacion estandar, calidad final y pruebas E2E.

## 9. Criterio de exito conjunto

El trabajo se considera correcto si:
- Ningun portal depende de mocks para funcionar.
- Los tres portales consumen backend real con auth/RBAC/ownership.
- Pagos solo se confirman por webhook Stripe.
- Cambios de un dev no rompen endpoints o UI del otro dev.
- Se cumplen criterios de aceptacion del PRD por modulo.
