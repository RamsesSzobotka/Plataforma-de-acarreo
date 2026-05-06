# Documentación Final — Plataforma de Acarreos

Última actualización: 2026-05-05

Resumen
-------
Este documento unifica y reemplaza la documentación dispersa del proyecto (frontend, backend y admin-frontend). Contiene: stack tecnológico, librerías clave, arquitectura, modelos de datos, endpoints, flujo de negocio y de pagos, despliegue y comandos para desarrollo y pruebas.

1. Visión general del proyecto
-----------------------------
- Propósito: marketplace B2B/B2C para acarreos y mudanzas que conecta clientes con conductores (drivers).
- Roles: `client`, `driver`, `admin`.
- Flujo de negocio resumido:
  1. Cliente crea un `ride` (pedido) → estado `requested`.
  2. Negociación/chat (`negotiating`).
  3. Driver acepta (`accepted`) → se acuerda precio final.
  4. Driver confirma carga y comienza viaje (`in_progress`).
  5. Driver entrega y sube foto (`completed`).
  6. Cliente confirma y realiza pago vía Stripe (`paid`).
  7. Ambas partes califican.

2. Stack tecnológico
--------------------
- Frontend (cliente): React + Vite, TypeScript, CSS/variables. Ver `frontend/`.
- Admin-Frontend: React + Vite, TypeScript. Ver `admin-frontend/`.
- Backend: Bun + Hono (Node-compatible), TypeScript, MongoDB (Mongoose). Ver `backend/`.
- Autenticación: Clerk (SSO) integrado con usuarios en DB.
- Pagos: Stripe PaymentIntents + webhooks.
- Almacenamiento de imágenes: Cloudinary (u otro servicio compatible) — utilizable desde `backend/utils/upload.ts`.

3. Librerías y dependencias clave
--------------------------------
- Frontend / Admin: `react`, `react-router` (o `react-router-dom`), `vite`, `axios` o cliente fetch encapsulado en `services/api.ts`.
- Backend: `hono`, `bun` runtime (scripts), `mongoose`, `stripe` (SDK), `multer`/upload helper o Cloudinary SDK.
- Testing: Jest / Bun testing (según `backend/__tests__/`).

4. Estructura general y archivos relevantes
-----------------------------------------
- Backend: rutas y lógica en `backend/src/routes/` — por ejemplo:
  - [backend/src/routes/rides.ts](backend/src/routes/rides.ts)
  - [backend/src/routes/webhooks.ts](backend/src/routes/webhooks.ts)
  - [backend/src/routes/messages.ts](backend/src/routes/messages.ts)
  - Servicios de pagos: [backend/src/services/stripeMarketplace.ts](backend/src/services/stripeMarketplace.ts)
- Modelos Mongoose en `backend/src/models/` — `ride.ts`, `user.ts`, `driver.ts`, `message.ts`, `rating.ts`.
- Frontend: UI y páginas en `frontend/src/pages/`, cliente API en `frontend/src/services/api.ts`.
- Admin-frontend: similar a frontend, ver `admin-frontend/src/pages/`.

5. Modelos de datos (resumen)
-----------------------------
- rides
  - Campos principales: `clientId`, `driverId?`, `title`, `description`, `type`, `images[]`, `pickupLocation`, `dropoffLocation`, `estimatedPrice`, `finalPrice?`, `status`, `deliveryPhoto?`, timestamps.
- users
  - `clerkId`, `email`, `role`, `imageUrl`, `isActive`.
- drivers
  - `userId`, `vehicleType`, `plate`, `capacityKg`, `isAvailable`, `currentLocation`, `verificationStatus`, `rating`.
- messages
  - `rideId`, `senderId`, `content`, `read`, `createdAt`.
- ratings
  - `rideId`, `raterId`, `ratedId`, `rating`, `comment`.

6. Endpoints API (resumen y responsabilidades)
---------------------------------------------
- Health: `GET /health` — estado del servidor. Ver [backend/src/routes/health.ts](backend/src/routes/health.ts).
- Auth: `POST /api/auth/webhook`, `GET /api/auth/me`. Ver [backend/src/routes/auth.ts](backend/src/routes/auth.ts).
- Rides:
  - `GET /api/rides` — listar (filtros: status, clientId, driverId)
  - `POST /api/rides` — crear ride
  - `GET /api/rides/:id` — obtener ride
  - `PATCH /api/rides/:id` — actualizar
  - `PATCH /api/rides/:id/status` — cambiar estado
  - `POST /api/rides/:id/accept` — driver acepta
  - `POST /api/rides/:id/start` — iniciar viaje
  - `POST /api/rides/:id/delivery-photo` — subir foto de entrega
  - `POST /api/rides/:id/cancel` — cancelar
  (Implementado en `backend/src/routes/rides.ts`.)
- Messages: `GET /api/messages/ride/:rideId`, `POST /api/messages` — ver `backend/src/routes/messages.ts`.
- Upload: `POST /api/upload` — helper para Cloudinary en `backend/utils/upload.ts`.
- Payments:
  - `POST /api/payments/create-intent` — crea PaymentIntent (cliente paga)
  - `POST /api/payments/webhook` — webhooks Stripe (marca `paid`) — ver [backend/src/routes/webhooks.ts](backend/src/routes/webhooks.ts) y `backend/src/services/stripeMarketplace.ts`.

7. Lógica de pagos y comisiones
-------------------------------
- Flujo de pago:
  1. Cliente confirma entrega en UI → frontend solicita `create-intent` al backend con `finalPrice`.
  2. Backend crea `PaymentIntent` con Stripe, devuelve client secret al frontend.
  3. Frontend usa Stripe.js para completar el pago.
  4. Stripe envía un webhook a `POST /api/payments/webhook`.
  5. Backend valida webhook (firma), marca `ride.status = 'paid'`, registra la transacción y crea registro de comisión.
- Comisión: Por defecto, plataforma toma 10% del `finalPrice`. Implementación de payout pendiente; actualmente se registra y calcula la comisión en `stripeMarketplace.ts`.

8. Estados del `ride` y reglas de cancelación
---------------------------------------------
- Estados oficiales: `requested`, `negotiating`, `accepted`, `in_progress`, `completed`, `paid`, `cancelled`.
- Reglas esenciales:
  - En `requested`/`negotiating`: cliente puede editar/cancelar.
  - En `accepted`: cliente NO puede editar/cancelar; driver puede cancelar con motivo.
  - En `in_progress`/`completed`/`paid`: ninguna parte puede cancelar (solo admin excepcionalmente).

9. Chat y tracking
-------------------
- Chat: canal por `rideId`, persistido en `messages` colección; implementar con WebSockets o WebSocket-like en Hono.
- Tracking: driver comparte ubicación mientras `in_progress` (puntos de actualización por frecuencia configurable).

10. Seguridad y buenas prácticas
--------------------------------
- Validar ownership en endpoints que mutan rides (comprobar `req.user` vs `ride.clientId/driverId`).
- Validar firmas de webhooks (Stripe) y evitar procesar eventos duplicados (idempotencia).
- Rate limiting en rutas públicas y sanitización de inputs.

11. Variables de entorno (ejemplo)
---------------------------------
Backend (.env):
```
DATABASE_URL=mongodb://admin:password@localhost:27017/plataforma_acarreo
CLERK_PUBLISHABLE_KEY=pk_test_xxxx
CLERK_SECRET_KEY=sk_test_xxxx
CLERK_WEBHOOK_SECRET=whsec_xxxx
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
CLOUDINARY_CLOUD_NAME=xxxx
CLOUDINARY_API_KEY=xxxx
CLOUDINARY_API_SECRET=xxxx
PORT=3000
```

12. Comandos de desarrollo
-------------------------
Backend (desde `backend/`):
```
bun install
bun run dev
```
Frontend (desde `frontend/`):
```
npm install
npm run dev
```
Admin-Frontend (desde `admin-frontend/`):
```
npm install
npm run dev
```

13. Pruebas y calidad
---------------------
- Tests unitarios: ver `backend/__tests__/`.
- Integración: pruebas de endpoints y webhooks (simular eventos Stripe).

14. Despliegue y recomendaciones
--------------------------------
- Desplegar backend en entorno que soporte Bun o Node (adaptar). Usar instancia con MongoDB gestionada (Atlas) y configurar variables.
- Configurar webhooks de Stripe con la URL pública y la llave `STRIPE_WEBHOOK_SECRET`.
- Usar CDN para assets y Cloudinary para imágenes.

15. Archivos importantes para revisar
-----------------------------------
- Rutas backend: [backend/src/routes/](backend/src/routes/)
- Modelos: [backend/src/models/](backend/src/models/)
- Servicios Stripe: [backend/src/services/stripeMarketplace.ts](backend/src/services/stripeMarketplace.ts)
- Upload helper: [backend/utils/upload.ts](backend/utils/upload.ts)
- Frontend API client: `frontend/src/services/api.ts`

16. Próximos pasos recomendados
------------------------------
- Implementar payouts automáticos (fase 2).
- Añadir pruebas E2E para el flujo completo (crear → accept → in_progress → complete → pay → rating).
- Documentar y asegurar roles y permisos con tests de integración.

Si quieres, actualizo este documento con fragmentos de código adicionales, diagramas o lo exporto a `docs/` en formato HTML/MDX.

17. Diagramas
-------------

Arquitectura general del sistema (cliente, admin, backend, servicios externos):

```mermaid
flowchart TB
  subgraph FE[Frontend - Cliente]
    A[App React]
  end
  subgraph AF[Admin-Frontend]
    B[Admin React]
  end
  subgraph BE[Backend]
    C[Hono API (Bun)]
    C --> D[(MongoDB)]
    C --> E[Stripe]
    C --> F[Cloudinary]
  end
  A --- C
  B --- C
  style FE fill:#f8fafc,stroke:#0d9488
  style AF fill:#f8fafc,stroke:#f97316
  style BE fill:#ffffff,stroke:#0f172a
```

Flujo de pagos y estado del `ride`:

```mermaid
sequenceDiagram
  participant Cliente
  participant Frontend
  participant Backend
  participant Stripe
  Cliente->>Frontend: Confirma entrega
  Frontend->>Backend: POST /api/payments/create-intent (finalPrice)
  Backend->>Stripe: Crea PaymentIntent
  Stripe-->>Backend: client_secret
  Backend-->>Frontend: client_secret
  Frontend->>Stripe: Completa pago (Stripe.js)
  Stripe-->>Backend: webhook payment_intent.succeeded
  Backend->>Backend: Validar firma, marcar ride as 'paid'
  Backend->>MongoDB: Guardar transacción y comisión
```

Diagrama de estados simplificado del `ride`:

```mermaid
stateDiagram-v2
  [*] --> requested
  requested --> negotiating
  negotiating --> accepted
  accepted --> in_progress
  in_progress --> completed
  completed --> paid
  any --> cancelled
```
