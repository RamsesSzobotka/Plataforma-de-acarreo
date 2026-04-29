# Carglyn - Plataforma de Acarreos

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │   Cliente   │  │  Conductor  │  │   Admin Portal          │   │
│  │   Portal   │  │  Dashboard │  │   (admin-frontend)     │   │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Bun + Hono)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Rides   │ │  Users    │ │ Messages │ │    Payments      │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │  Auth    │ │  Upload  │ │  Admin   │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   DATABASE (MongoDB)                                   │
│  rides │ users │ drivers │ messages │ ratings                            │
└─────────────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
   ┌─────────────┐                      ┌─────────────┐
   │   Clerk    │                      │   Stripe   │
   │  (Auth)    │                      │  (Pagos)   │
   └─────────────┘                      └─────────────┘
         │                                         │
         └────────────────────┬────────────────────┘
                              ▼
                        ┌─────────────┐
                        │ Cloudinary │
                        │  (Imágenes)│
                        └─────────────┘
```

---

## Stack Tecnológico

### Backend
| Tecnología | Versión | Propósito |
|------------|--------|----------|
| **Bun** | ^1.3.0 | Runtime de JavaScript |
| **Hono** | ^4.0.0 | Framework web (API REST) |
| **Mongoose** | ^8.9.0 | ODM para MongoDB |
| **@clerk/clerk-sdk-node** | ^5.0.0 | Autenticación (SSO) |
| **Stripe** | ^17.0.0 | Procesamiento de pagos |
| **Cloudinary** | ^2.0.0 | Almacenamiento de imágenes |
| **bcryptjs** | ^2.4.3 | Hash de contraseñas |
| **cors** | ^2.8.5 | CORS middleware |
| **dotenv** | ^16.4.0 | Variables de entorno |

### Frontend (Cliente)
| Tecnología | Versión | Propósito |
|------------|--------|----------|
| **React** | ^18.3.1 | UI Framework |
| **Vite** | ^6.0.0 | Build tool |
| **@clerk/clerk-react** | ^5.17.0 | Autenticación (UI) |
| **@stripe/react-stripe-js** | ^6.3.0 | UI de pagos |
| **@stripe/stripe-js** | ^5.1.0 | Cliente de Stripe |
| **react-router-dom** | ^6.28.0 | Enrutamiento |
| **leaflet** | ^1.9.4 | Mapas |
| **react-leaflet** | ^4.2.1 | Mapas para React |

### Admin Frontend
| Tecnología | Versión | Propósito |
|------------|--------|----------|
| **React** | ^18.3.1 | UI Framework |
| **Vite** | ^6.0.0 | Build tool |
| **react-router-dom** | ^6.28.0 | Enrutamiento |

---

## Estructura de Carpetas

```
plataforma-de-acarreo/
├── backend/                           # Servidor API
│   ├── src/
│   │   ├── index.ts                 # Entry point
│   │   ├── db/
│   │   │   └── mongo.ts            # Conexión MongoDB
│   │   ├── models/                # Modelos Mongoose
│   │   │   ├── ride.ts           # Ride
│   │   │   ├── user.ts          # User
│   │   │   ├── driver.ts       # Driver
│   │   │   ├── message.ts     # Message
│   │   │   └── rating.ts      # Rating
│   │   ├── routes/             # Endpoints API
│   │   │   ├── rides.ts      # /api/rides
│   │   │   ├── users.ts     # /api/users
│   │   │   ├── messages.ts  # /api/messages
│   │   │   ├── payments.ts # /api/payments
│   │   │   ├── auth.ts    # /api/auth
│   │   │   ├── upload.ts   # /api/upload
│   │   │   ├── admin.ts   # /api/admin
│   │   │   └── health.ts  # /api/health
│   │   └── middleware/         # Middlewares
│   │       ├── auth.ts       # Autenticación
│   │       └── role.ts      # Roles
│   ├── package.json
│   ├── tsconfig.json
│   ├── docker-compose.yml    # MongoDB + Redis
│   └── .env.example
│
├── frontend/                        # Frontend cliente
│   ├── src/
│   │   ├── main.tsx             # Entry point
│   │   ├── App.tsx              # Router
│   │   ├── components/         # Componentes reuse
│   │   ├── pages/              # Páginas
│   │   ├── services/          # API client
│   │   └── types/             # TypeScript types
│   ├── package.json
│   └── index.html
│
├── admin-frontend/               # Panel admin
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── pages/
│   └── package.json
│
└── Doc/
    ├── PRD-Plataforma de acarreso.md
    └── AGENTS.md
```

---

## Modelos de Base de Datos

### 1. Ride (Pedido)
```typescript
{
  _id: ObjectId
  clientId: string              // clerkId del cliente
  driverId?: string            // clerkId del conductor asignado
  
  title: string                // Título del pedido
  description: string         // Descripción detallada
  type: 'mudanza' | 'electrodomesticos' | 'muebles' | 'productos' | 'otros'
  
  images: [{ url: string, publicId?: string }]  // Fotos (1-8)
  
  pickupLocation: {
    address: string
    coordinates: [lng, lat]   // GeoJSON
  }
  dropoffLocation: {
    address: string
    coordinates: [lng, lat]
  }
  
  estimatedPrice: number       // Precio sugerido
  finalPrice?: number        // Precio acordado
  
  packages?: number          // Bultos
  weight?: number           // Peso
  notes?: string           // Notas especiales
  
  status: 'requested' | 'negotiating' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'cancelled'
  chatEnabled: boolean
  
  deliveryPhoto?: { url, publicId }
  cancellationReason?: string
  
  stripePaymentMethodId?: string
  paymentIntentId?: string
  paidAt?: Date
  
  createdAt: Date
  updatedAt: Date
}
```

### 2. User (Usuario)
```typescript
{
  _id: ObjectId
  clerkId: string           // ID único de Clerk
  
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
  
  role: 'client' | 'driver' | 'admin'
  isActive: boolean
  
  phone?: string
  
  stripePaymentMethodId?: string
  
  password?: string        // Solo para admin (bcrypt)
  
  createdAt: Date
  updatedAt: Date
}
```

### 3. Driver (Conductor)
```typescript
{
  _id: ObjectId
  userId: string           // clerkId
  
  // Info básica
  vehicleType: string     // 'camioneta' | 'camion' | 'furgon' | 'grua' | 'otro'
  plate: string          // Normalizada: ABC-1234
  capacityKg: number
  
  // Docs obligatorios
  vehicleImages: [string]
  licenseType: string
  licenseImage: string
  cedulaFront: string
  cedulaBack: string
  ruvDocument: string
  plateImage: string
  insurancePolicy: string
  
  // Docs opcionales
  carneBlanco?: string
  carneVerde?: string
  carneTransporteCarga?: string
  fumigationCertificate?: string
  
  phone: string
  
  // Verificación
  verificationStatus: 'pending' | 'in_review' | 'verified' | 'rejected' | 'suspended'
  rejectionReason?: string
  reviewedBy?: string
  reviewedAt?: Date
  
  // Disponibilidad
  isAvailable: boolean
  currentLocation?: { type: 'Point', coordinates: [lng, lat] }
  
  // Calificación
  rating: number
  totalRides: number
  
  stripeAccountId?: string
  
  createdAt: Date
  updatedAt: Date
}
```

### 4. Message (Chat)
```typescript
{
  _id: ObjectId
  rideId: string
  senderId: string
  content: string
  read: boolean
  createdAt: Date
}
```

### 5. Rating (Calificación)
```typescript
{
  _id: ObjectId
  rideId: string
  raterId: string        // Quién califica
  ratedId: string       // Quién recibe
  role: 'client' | 'driver'
  
  rating: number       // 1-5
  comment?: string
  
  createdAt: Date
}
```

---

## Endpoints API

### Health
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/health` | ❌ | Estado del servidor |

### Auth
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/auth/webhook` | ❌ | Webhook de Clerk |
| GET | `/api/auth/me` | ✅ | Usuario actual |

### Rides
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/rides/available` | ✅ | Listar pedidos disponibles para driver |
| GET | `/api/rides` | ✅ | Listar rides (filtros) |
| POST | `/api/rides` | ✅ | Crear ride |
| GET | `/api/rides/:id` | ✅ | Obtener ride |
| PATCH | `/api/rides/:id` | ✅ | Actualizar ride |
| PATCH | `/api/rides/:id/status` | ✅ | Cambiar estado |
| POST | `/api/rides/:id/accept` | ✅ | Conductor acepta |
| POST | `/api/rides/:id/start` | ✅ | Iniciar viaje |
| POST | `/api/rides/:id/delivery-photo` | ✅ | Subir foto entrega |
| POST | `/api/rides/:id/confirm-delivery` | ✅ | Confirmar entrega |
| POST | `/api/rides/:id/cancel` | ✅ | Cancelar ride |
| POST | `/api/rides/:id/rate` | ✅ | Calificar |
| POST | `/api/rides/:id/payment-method` | ✅ | Guardar método pago |

### Users
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/users` | ✅ | Listar usuarios |
| GET | `/api/users/:clerkId` | ❌ | Obtener usuario |
| POST | `/api/users` | ❌ | Crear/actualizar |
| POST | `/api/users/register-driver` | ✅ | Registrar conductor |
| GET | `/api/users/driver/me` | ✅ | Mi perfil conductor |
| GET | `/api/users/driver/:userId` | ❌ | Perfil conductor |
| PATCH | `/api/users/driver/profile` | ✅ | Actualizar perfil |
| PATCH | `/api/users/driver/resubmit` | ✅ | Reenviar a verificación |
| PATCH | `/api/users/driver/:userId/availability` | ✅ | Disponibilidad |
| PATCH | `/api/users/driver/:userId/location` | ✅ | Ubicación |
| GET | `/api/users/drivers` | ✅ | Listar drivers (admin) |
| PATCH | `/api/users/driver/:userId/verify` | ✅ | Aprobar/rechazar |
| POST | `/api/users/payment-method` | ✅ | Guardar método pago |
| GET | `/api/users/me/payment-method` | ✅ | Mi método pago |

### Messages
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/messages/ride/:rideId` | ✅ | Mensajes de ride |
| POST | `/api/messages` | ✅ | Enviar mensaje |
| PATCH | `/api/messages/ride/:rideId/read` | ✅ | Marcar leídos |

### Payments
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/payments/create-intent` | ✅ | Crear PaymentIntent |
| POST | `/api/payments/webhook` | ❌ | Webhook Stripe |
| POST | `/api/payments/confirm` | ✅ | Confirmar pago |

### Upload
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/upload` | ✅ | Subir imagen |

---

## Flujo de Estados del Ride

```
requested ──► negotiating ──► accepted ──► in_progress ──► completed ──► paid
    │              │               │            │                │            │
    │              │               │            │                │            │
    └──────────┐   │               │            │                │            │
    Cliente   │    │               │            │                │            │
    puede    │    │      Conductor │   Conductor │   Cliente       │            │
    editar/  │    │      acepta   │   inicia   │   confirma     │            │
    cancelar │    │               │   tracking │   entrega       │            │
              └──────────┬────────┘            │                │            │
                         │                     │                │            │
                     Chat activo           Tracking          Pago
                                           activo           automático
```

### Reglas de Cancelación
| Estado | ¿Quién puede cancelar? |
|--------|------------------------|
| requested | Cliente |
| negotiating | Cliente |
| accepted | Conductor |
| in_progress | Solo admin (excepcional) |
| completed | Solo admin (excepcional) |
| paid | ❌ No |
| cancelled | ❌ No |

---

## Lógica de Negocio

### 1. Verificación de Conductores
```
Pendiente -> In Review -> Verified / Rejected
                              │
                              ▼
                    Si rejected: puede resubir
                    (solo si tiene reason)
```

### 2. Comisiones
- **Plataforma**: 10% del monto final
- **Conductor**: 90% del monto final

### 3. Pago Automático
1. Cliente guarda método de pago en su perfil
2. Conductor confirma entrega + foto
3. Cliente confirma entrega
4. Backend cobra automáticamente via Stripe `off_session: true`
5. Si falla, queda en `completed` y requiere pago manual

### 4. Chat
- Disponible en estados: `negotiating` o `accepted`
- Un mensaje por ride
- Tiempo real (polling o WebSocket - TODO)

---

## Variables de Entorno

### Backend (.env)
```bash
DATABASE_URL=mongodb://admin:password@localhost:27017/plataforma_acarreo
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx
PORT=3000
NODE_ENV=development
```

### Frontend (.env)
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_API_URL=http://localhost:3000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_CLOUDINARY_CLOUD_NAME=xxxxx
```

---

## Scripts

### Backend
```bash
cd backend
bun run dev          # Desarrollo con watch
bun run start       # Producción
bun run db:up       # Iniciar MongoDB (Docker)
bun run db:down     # Detener MongoDB
bun run db:logs     # Ver logs
```

### Frontend
```bash
cd frontend
bun run dev         # Desarrollo
bun run build      # Build producción
bun run preview   # Preview
bun run lint      # Lint
```

---

## Tecnologías Externas

| Servicio | Propósito | URL |
|----------|----------|-----|
| **Clerk** | Autenticación SSO | clerk.com |
| **Stripe** | Pagos | stripe.com |
| **Cloudinary** | Imágenes | cloudinary.com |
| **MongoDB** | Base de datos | mongodb.com |
| **Google Fonts** | Tipografía | fonts.google.com |
| **Material Symbols** | Iconos | fonts.google.com/icons |