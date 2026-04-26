# Responsabilidades Fullstack - Dev 1

Basado en el PRD oficial. Este documento define el alcance de Dev 1 sin romper la conectividad con Dev 2.

## 1. Lineamientos generales (compartidos)

- Mantener stack: React + Vite, Bun + Honor, MongoDB, Clare SSO, Stripe.
- Toda API nueva bajo /api/v1.
- No romper contratos existentes; si cambia algo, usar compatibilidad.
- Respuesta API uniforme:
  - Exito: { data, meta }
  - Error: { error: { code, message, details? } }
- Paginacion estandar en listados: page, limit, sortBy, sortOrder, search, status.
- Seguridad obligatoria: auth, RBAC, ownership y validacion de inputs.

## 2. Alcance de Dev 1

Responsabilidad principal: plataforma base, cliente y pagos.

### Backend (owner Dev 1)

- Base tecnica del backend:
  - configuracion de entorno, conexion DB, config Stripe
  - middlewares globales (auth, role, ownership, paginacion, errores)
- M01 Auth SSO (Clare):
  - redirect y callback
  - sincronizacion de usuario autenticado
- M02 Users y Roles (base):
  - esquema Users y estado de usuario
- M03 Portal Cliente (API):
  - crear ride
  - listar rides del cliente (paginado)
  - detalle de ride
- M05 Rides Engine (parte cliente):
  - creacion inicial del ride (requested)
- M06 Pagos Stripe:
  - crear PaymentIntent
  - webhook seguro con firma e idempotencia
  - ride pasa a paid solo por webhook valido

### Frontend (owner Dev 1)

- Rutas protegidas y base de autenticacion.
- Portal Cliente:
  - crear solicitud
  - seguimiento de estado
  - historial paginado
  - pago
- Cliente API layer para modulo cliente/pagos.

## 3. Dependencias con Dev 2

- Dev 1 entrega primero:
  - auth estable
  - contrato de Users y endpoints cliente iniciales
- Dev 1 depende de Dev 2 para:
  - estados operativos del ride (accepted/in_progress/completed)
- Dev 1 devuelve a Dev 2:
  - estado paid confirmado por webhook para admin/reportes

## 4. Orden recomendado para Dev 1

1. Fundacion backend (env, DB, server, middlewares).
2. M01 Auth SSO + M02 Users base.
3. M03 Cliente (crear/listar/detalle de ride).
4. Integracion con flujo de estados definido por Dev 2.
5. M06 Pagos (PaymentIntent + webhook + reconciliacion).
6. Ajustes finales de paginacion, seguridad y pruebas.

## 5. Regla de no ruptura

Antes de mergear, Dev 1 valida:
- Que no se rompan endpoints consumidos por conductor/admin.
- Que los cambios de auth no invaliden flujos de Dev 2.
- Caso feliz y negativo de cada modulo intervenido.
