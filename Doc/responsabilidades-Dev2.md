# Responsabilidades Fullstack - Dev 2

Basado en el PRD oficial. Este documento define el alcance de Dev 2 sin romper la conectividad con Dev 1.

## 1. Lineamientos generales (compartidos)

- Mantener stack: React + Vite, Bun + Honor, MongoDB, Clare SSO, Stripe.
- Toda API nueva bajo /api/v1.
- No romper contratos existentes; si cambia algo, usar compatibilidad.
- Respuesta API uniforme:
  - Exito: { data, meta }
  - Error: { error: { code, message, details? } }
- Paginacion estandar en listados: page, limit, sortBy, sortOrder, search, status.
- Seguridad obligatoria: auth, RBAC, ownership y validacion de inputs.

## 2. Alcance de Dev 2

Responsabilidad principal: conductor, realtime y back office admin.

### Backend (owner Dev 2)

- M04 Portal Conductor (API):
  - aceptar ride
  - actualizar estado
  - historial de rides del conductor (paginado)
- M05 Rides Engine (parte operativa):
  - reglas de asignacion/aceptacion
  - transiciones accepted -> in_progress -> completed/cancelled
- M07 WebSockets:
  - autenticacion de socket
  - eventos de ubicacion y estados de ride
- M08 Admin:
  - endpoints de users/drivers/rides/payments con filtros y paginacion
- M09 Auditoria Admin:
  - bitacora de acciones criticas
- M10 Optimizacion (dominio conductor/admin):
  - indices y consultas principales

### Frontend (owner Dev 2)

- Portal Conductor:
  - disponibilidad
  - aceptacion de ride
  - actualizacion de estado
  - tracking en vivo
  - historial paginado
- Back Office Admin:
  - dashboard
  - gestion users/drivers/rides/payments
  - filtros, busqueda y paginacion
  - vista de auditoria

## 3. Dependencias con Dev 1

- Dev 2 depende de Dev 1 para:
  - auth estable y contexto de usuario
  - creacion inicial de rides desde cliente
  - estado paid confirmado por webhook para vistas admin
- Dev 2 entrega a Dev 1:
  - estados operativos finales del ride para habilitar cierre de pago

## 4. Orden recomendado para Dev 2

1. Alinear contratos de rides con Dev 1.
2. M04 Conductor (aceptar/estado/listado).
3. M07 Realtime (socket + eventos).
4. M08 Admin (modulos operativos).
5. M09 Auditoria admin.
6. M10 Optimizacion, seguridad y pruebas.

## 5. Regla de no ruptura

Antes de mergear, Dev 2 valida:
- Que no cambien contratos usados por portal cliente/pagos.
- Que eventos realtime no rompan flujo base de rides.
- Caso feliz y negativo de cada modulo intervenido.
