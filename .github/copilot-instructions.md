# Reglas globales del proyecto Plataforma de Acarreo

Estas reglas aplican a todo cambio de codigo y documentacion tecnica.

## 1. Stack obligatorio

- Frontend: React + Vite.
- Backend: Bun + Honor.
- Base de datos: MongoDB.
- Auth: Clare SSO.
- Pagos: Stripe.
- No sustituir tecnologias base sin aprobacion explicita.

## 2. Arquitectura y modularidad

- Implementar por vertical slice (backend + frontend por historia).
- Separar responsabilidades: routes, controllers, services, repositories.
- Mantener modulos por dominio: auth, users, drivers, rides, payments, ratings, admin.
- No cerrar modulo frontend sin backend real conectado.

## 3. Contrato API

- Versionado obligatorio: /api/v1.
- Respuesta de exito: { data, meta } cuando aplique.
- Respuesta de error: { error: { code, message, details? } }.
- No romper contratos existentes; usar compatibilidad o versionado.

## 4. Seguridad obligatoria

- Validar token, estado de usuario y rol en todo endpoint protegido.
- Aplicar RBAC y ownership checks anti-IDOR en backend.
- Validacion estricta de inputs y sanitizacion en entrada.
- Manejo de errores sin filtrar stack trace en produccion.

## 5. Reglas de pagos Stripe

- El estado paid solo puede confirmarse por webhook oficial de Stripe.
- Validar firma con STRIPE_WEBHOOK_SECRET.
- Implementar idempotencia por event.id.
- Nunca confiar en frontend para marcar pagos como confirmados.

## 6. Reglas realtime

- Validar token antes de aceptar sockets.
- Asociar conexion a userId y role.
- Soportar eventos: driver:location:update, ride:new_request, ride:accepted, ride:status_update.
- Aplicar rate limit en canal de ubicacion.

## 7. Paginacion y busqueda

- Estandar en listados: page, limit, sortBy, sortOrder, search, status.
- Defaults: page=1, limit=20.
- Maximo: limit=100.

## 8. Calidad minima por modulo

- Cada modulo requiere prueba minima de caso feliz y caso negativo.
- Validar flujo de integracion frontend-backend antes de merge.
- No hacer merge si rompe portal cliente, conductor o admin.

## 9. Criterio de done

Un cambio esta completo solo si:
- cumple seguridad (auth + RBAC + ownership),
- respeta contrato API,
- mantiene conectividad real con frontend,
- y no rompe pagos/webhook ni estado de rides.
