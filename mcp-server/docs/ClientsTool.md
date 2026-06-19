# ClientsTool.md — MCP Tools del Cliente

> **Proyecto**: Plataforma de Acarreos — MCP Server
> **Responsable**: Ramses Szobotka
> **Rol**: Cliente-side
> **Versión**: 1.0

---

## Índice de Tools

| # | Tool | Archivo | Estado |
|---|------|---------|--------|
| 1 | `list_my_rides` | `src/tools/list-my-rides.ts` | ⏳ Pendiente |
| 2 | `create_ride` | `src/tools/create-ride.ts` | ⏳ Pendiente |
| 3 | `get_ride_details` | `src/tools/get-ride-details.ts` | ⏳ Pendiente |
| 7 | `view_offers` | `src/tools/view-offers.ts` | ⏳ Pendiente |
| 8 | `accept_offer` | `src/tools/accept-offer.ts` | ⏳ Pendiente |

---

## Tool 1: `list_my_rides`

### Propósito
Obtiene las solicitudes de acarreo del cliente autenticado. Permite al cliente consultar el estado de todas sus publicaciones con filtros opcionales.

### Parámetros de Entrada

| Parámetro | Tipo | Requerido | Default | Validación | Descripción |
|-----------|------|-----------|---------|------------|-------------|
| `authToken` | `string` | Sí | — | Debe ser un JWT válido de Clerk | Token de autenticación del usuario |
| `status` | `enum` | No | — | `requested` \| `negotiating` \| `accepted` \| `in_progress` \| `completed` \| `paid` \| `cancelled` | Filtrar por estado del acarreo |
| `page` | `number` | No | `1` | Mín: 1, Entero | Número de página |
| `limit` | `number` | No | `10` | Mín: 1, Máx: 50, Entero | Elementos por página |

### Formato de Respuesta

```typescript
{
  rides: {
    id: string,                // _id del backend
    title: string,             // Título del acarreo
    type: RideType,            // Tipo de acarreo
    status: RideStatus,        // Estado actual
    estimatedPrice: number,    // Precio estimado
    finalPrice?: number,       // Precio final (si aplica)
    pickupAddress: string,     // Dirección de recogida
    dropoffAddress: string,    // Dirección de destino
    createdAt: string,         // Fecha de creación ISO
    driverName?: string,       // Nombre del conductor (si asignado)
    clientName?: string,       // Nombre del cliente
  }[],
  total: number,               // Total de resultados
  page: number,                // Página actual
  limit: number                // Elementos por página
}
```

### Endpoint Backend
`GET /api/rides?clientId={userId}&status={status}&page={page}&limit={limit}`

### Servicios del Backend Utilizados
- **Ruta**: `backend/src/routes/rides.ts` — `GET /` handler
- **Middleware**: `authMiddleware` — autenticación via Clerk JWT
- **Modelo**: `Ride` (Mongoose) con filtros por `clientId`

### Flujo de Ejecución
1. El agente IA recibe los parámetros del usuario, incluyendo su `authToken` de Clerk
2. El MCP server extrae `authToken` de los argumentos raw antes de la validación Zod
3. El handler valida parámetros con `listMyRidesSchema` (excluyendo `authToken`)
4. El handler determina el `userId` — se obtiene decodificando el JWT de Clerk para obtener el `sub` (clerkId), o bien se pasa como parámetro
5. Se hace GET a `{BACKEND_URL}/api/rides?clientId={userId}&status={status}&page={page}&limit={limit}` con el `authToken` del usuario como Bearer
6. El backend aplica ownership check: clientes solo ven sus propios rides
7. Se transforma la respuesta `{ data, pagination }` → `{ rides, total, page, limit }`
8. Se transforma `_id` → `id` en cada ride de la lista

### Permisos y Seguridad
- El backend verifica el token JWT de Clerk en el middleware de autenticación
- El backend valida ownership: un cliente solo puede ver sus propios rides
- El MCP server pasa el `authToken` del usuario al backend sin modificarlo

### Ejemplos de Uso

**Agente IA → MCP Server:**
```json
{
  "name": "list_my_rides",
  "arguments": {
    "authToken": "jwt_de_clerk_del_usuario",
    "status": "requested",
    "page": 1,
    "limit": 10
  }
}
```

**Respuesta exitosa:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"rides\":[{\"id\":\"abc123\",\"title\":\"Mudanza a Tocumen\",\"type\":\"mudanza\",\"status\":\"requested\",\"estimatedPrice\":150,\"pickupAddress\":\"Calle 50, Panamá\",\"dropoffAddress\":\"Tocumen, Panamá\",\"createdAt\":\"2026-06-18T10:00:00Z\"}],\"total\":1,\"page\":1,\"limit\":10}"
    }
  ]
}
```

### Posibles Errores

| Código | Mensaje | Causa |
|--------|---------|-------|
| `UNAUTHORIZED` | Token de autenticación inválido o expirado | `authToken` inválido |
| `BACKEND_ERROR` | Error interno del backend | Error del servidor |
| `BACKEND_UNAVAILABLE` | No se pudo conectar con el backend después de N intentos | Backend caído |

---

## Tool 2: `create_ride`

### Propósito
Publica una nueva solicitud de acarreo. El cliente proporciona origen, destino, descripción de la carga, tipo y precio estimado.

### Parámetros de Entrada

| Parámetro | Tipo | Requerido | Validación | Descripción |
|-----------|------|-----------|------------|-------------|
| `authToken` | `string` | Sí | JWT válido de Clerk | Token de autenticación del usuario |
| `title` | `string` | Sí | Min 3, Max 200 chars | Título descriptivo del acarreo |
| `description` | `string` | Sí | Min 10, Max 2000 chars | Descripción detallada de la carga |
| `type` | `enum` | Sí | `mudanza` \| `electrodomésticos` \| `muebles` \| `productos` \| `otros` | Tipo de acarreo |
| `pickupAddress` | `string` | Sí | Min 5, Max 500 chars | Dirección de recogida |
| `pickupLat` | `number` | Sí | -90 a 90 | Latitud de recogida |
| `pickupLng` | `number` | Sí | -180 a 180 | Longitud de recogida |
| `dropoffAddress` | `string` | Sí | Min 5, Max 500 chars | Dirección de destino |
| `dropoffLat` | `number` | Sí | -90 a 90 | Latitud de destino |
| `dropoffLng` | `number` | Sí | -180 a 180 | Longitud de destino |
| `estimatedPrice` | `number` | Sí | Positivo | Precio sugerido en USD |
| `packages` | `number` | No | Entero positivo | Número aproximado de bultos |
| `notes` | `string` | No | Max 1000 chars | Notas especiales (frágil, requiere ayuda, etc.) |
| `preferredDate` | `string` | No | ISO 8601 | Fecha preferida |

### Formato de Respuesta

```typescript
{
  ride: {
    id: string,
    clientId: string,
    driverId?: string,
    title: string,
    description: string,
    type: RideType,
    images: { url: string }[],
    pickupLocation: { address: string, coordinates: [number, number] },
    dropoffLocation: { address: string, coordinates: [number, number] },
    estimatedPrice: number,
    finalPrice?: number,
    packages?: number,
    notes?: string,
    preferredDate?: string,
    status: 'requested',
    createdAt: string,
    updatedAt: string
  }
}
```

### Endpoint Backend
`POST /api/rides`

### Servicios del Backend Utilizados
- **Ruta**: `backend/src/routes/rides.ts` — `POST /` handler
- **Middleware**: `authMiddleware` — autenticación via Clerk JWT
- **Modelo**: `Ride` (Mongoose) — creación del documento

### Flujo de Ejecución
1. El agente IA recibe los parámetros del usuario, incluyendo `authToken`
2. El MCP server extrae `authToken` de los args raw antes de la validación Zod
3. El handler valida parámetros con `createRideSchema`
4. **Transformación de datos**: los campos planos del schema MCP se convierten al formato anidado del backend:
   - `pickupAddress`, `pickupLat`, `pickupLng` → `pickupLocation: { address, coordinates: [lng, lat] }`
   - `dropoffAddress`, `dropoffLat`, `dropoffLng` → `dropoffLocation: { address, coordinates: [lng, lat] }`
5. Se envía `images: []` (arreglo vacío) ya que la subida de imágenes se maneja por separado (Cloudinary)
6. Se envía POST a `{BACKEND_URL}/api/rides` con el body transformado y el `authToken` del usuario como Bearer
7. Se transforma `_id` → `id` en la respuesta

### Permisos y Seguridad
- El backend verifica el token JWT de Clerk
- El backend valida ownership: un cliente no puede crear rides con `clientId` de otro usuario
- El backend valida que exista un `stripePaymentMethodId` en el perfil del usuario o en el body

### Notas Importantes
- El campo `type` usa el valor `electrodomésticos` (con acento y ñ) para el MCP, pero el backend espera `electrodomesticos` (sin acento). El handler debe normalizar este valor.
- El backend requiere un `stripePaymentMethodId`. Si el usuario no tiene uno guardado, el ride fallará. El handler debe devolver un error claro en este caso.
- El backend valida que el ride tenga al menos 1 imagen. Como el MCP envía `images: []`, se debe obtener el ID del ride creado y luego subir imágenes por separado.
- El campo `clientId` se obtiene del token JWT del usuario (decodificando el `sub` del JWT de Clerk).

### Ejemplos de Uso

**Agente IA → MCP Server:**
```json
{
  "name": "create_ride",
  "arguments": {
    "authToken": "jwt_de_clerk_del_usuario",
    "title": "Mudanza de apartamento a casa",
    "description": "Necesito trasladar muebles de un apartamento de 2 habitaciones a una casa en la misma ciudad. Incluye sofá, camas, mesa, sillas y cajas.",
    "type": "mudanza",
    "pickupAddress": "Calle 50, Edificio Boston, Panamá",
    "pickupLat": 8.9824,
    "pickupLng": -79.5199,
    "dropoffAddress": "Tocumen, Residencial Los Andes, Panamá",
    "dropoffLat": 9.0833,
    "dropoffLng": -79.3833,
    "estimatedPrice": 250,
    "packages": 15,
    "notes": "Los muebles son frágiles, manejar con cuidado",
    "preferredDate": "2026-06-25T09:00:00Z"
  }
}
```

**Respuesta exitosa:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"ride\":{\"id\":\"abc123\",\"clientId\":\"user_clerk_id\",\"title\":\"Mudanza de apartamento a casa\",\"description\":\"Necesito trasladar muebles...\",\"type\":\"mudanza\",\"images\":[],\"pickupLocation\":{\"address\":\"Calle 50, Edificio Boston, Panamá\",\"coordinates\":[-79.5199,8.9824]},\"dropoffLocation\":{\"address\":\"Tocumen, Residencial Los Andes, Panamá\",\"coordinates\":[-79.3833,9.0833]},\"estimatedPrice\":250,\"packages\":15,\"notes\":\"Los muebles son frágiles, manejar con cuidado\",\"status\":\"requested\",\"createdAt\":\"2026-06-18T10:00:00Z\",\"updatedAt\":\"2026-06-18T10:00:00Z\"}}"
    }
  ]
}
```

### Posibles Errores

| Código | Mensaje | Causa |
|--------|---------|-------|
| `INVALID_INPUT` | Campos requeridos faltantes | No se enviaron todos los campos obligatorios |
| `INVALID_INPUT` | Se requiere al menos una imagen del pedido | No se incluyeron imágenes |
| `UNAUTHORIZED` | Token de autenticación inválido o expirado | `authToken` inválido |
| `FORBIDDEN` | No tienes permiso para crear pedidos para otro usuario | `clientId` no coincide con el token |
| `PAYMENT_METHOD_REQUIRED` | No tienes un método de pago guardado... | El usuario no ha configurado un método de pago en su perfil de Carglyn |
| `INVALID_INPUT` | Debes guardar un método de pago primero | Usuario sin `stripePaymentMethodId` |
| `BACKEND_ERROR` | Error al crear el pedido | Error interno del backend |

---

## Tool 3: `get_ride_details`

### Propósito
Muestra la información completa de un acarreo específico, incluyendo ubicaciones, imágenes, conductor asignado (si existe) y estado actual.

### Parámetros de Entrada

| Parámetro | Tipo | Requerido | Validación | Descripción |
|-----------|------|-----------|------------|-------------|
| `authToken` | `string` | Sí | JWT válido de Clerk | Token de autenticación del usuario |
| `rideId` | `string` | Sí | Min 1 char | ID del acarreo |

### Formato de Respuesta

```typescript
{
  ride: {
    id: string,
    clientId: string,
    driverId?: string,
    title: string,
    description: string,
    type: RideType,
    images: { url: string }[],
    pickupLocation: { address: string, coordinates: [number, number] },
    dropoffLocation: { address: string, coordinates: [number, number] },
    estimatedPrice: number,
    finalPrice?: number,
    packages?: number,
    notes?: string,
    preferredDate?: string,
    status: RideStatus,
    deliveryPhoto?: { url: string },
    cancellationReason?: string,
    createdAt: string,
    updatedAt: string
  }
}
```

### Endpoint Backend
`GET /api/rides/:id`

### Servicios del Backend Utilizados
- **Ruta**: `backend/src/routes/rides.ts` — `GET /:id` handler
- **Middleware**: `authMiddleware`
- **Modelo**: `Ride.findById(id)`

### Flujo de Ejecución
1. El agente recibe `authToken` y `rideId`
2. El handler hace GET a `{BACKEND_URL}/api/rides/{rideId}` con el `authToken` como Bearer
3. El backend verifica autenticación y ownership (solo el cliente dueño del ride puede verlo, o admin)
4. Se transforma `_id` → `id` en la respuesta
5. Se eliminan campos internos como `__v`, `stripePaymentMethodId` de la respuesta expuesta

### Permisos y Seguridad
- El backend verifica el token JWT de Clerk
- El backend valida ownership: el cliente solo puede ver sus propios rides
- Si el ride no existe, el backend devuelve 404

### Ejemplos de Uso

**Agente IA → MCP Server:**
```json
{
  "name": "get_ride_details",
  "arguments": {
    "authToken": "jwt_de_clerk_del_usuario",
    "rideId": "abc123"
  }
}
```

**Respuesta exitosa:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"ride\":{\"id\":\"abc123\",\"clientId\":\"user_clerk_id\",\"title\":\"Mudanza a Tocumen\",\"description\":\"...\",\"type\":\"mudanza\",\"pickupLocation\":{\"address\":\"Calle 50, Panamá\",\"coordinates\":[-79.5199,8.9824]},\"dropoffLocation\":{\"address\":\"Tocumen, Panamá\",\"coordinates\":[-79.3833,9.0833]},\"estimatedPrice\":150,\"status\":\"requested\",\"createdAt\":\"2026-06-18T10:00:00Z\",\"updatedAt\":\"2026-06-18T10:00:00Z\"}}"
    }
  ]
}
```

### Posibles Errores

| Código | Mensaje | Causa |
|--------|---------|-------|
| `NOT_FOUND` | Ride no encontrado | El ID no existe |
| `FORBIDDEN` | No tienes permiso para ver este pedido | El ride pertenece a otro cliente |
| `UNAUTHORIZED` | Token inválido o expirado | `authToken` inválido |

---

## Tool 7: `view_offers`

### Propósito
⚠️ **ESTADO: Pendiente de implementación en el backend**

Permite al cliente revisar todas las ofertas recibidas para una de sus publicaciones, incluyendo el nombre del conductor, precio propuesto, calificación y mensaje.

### Parámetros de Entrada

| Parámetro | Tipo | Requerido | Validación | Descripción |
|-----------|------|-----------|------------|-------------|
| `authToken` | `string` | Sí | JWT válido de Clerk | Token de autenticación del usuario |
| `rideId` | `string` | Sí | Min 1 char | ID del acarreo |

### Formato de Respuesta (Esperado)

```typescript
{
  offers: {
    id: string,
    rideId: string,
    driverId: string,
    price: number,
    message?: string,
    status: 'pending' | 'accepted' | 'rejected',
    createdAt: string,
    driverName: string,
    driverRating: number,
    driverImageUrl?: string,
    driverTotalRides: number
  }[]
}
```

### Endpoint Backend Requerido (NO EXISTE)
`GET /api/rides/:id/offers`

### Estado Actual del Backend
El backend actualmente **no tiene** un endpoint `GET /api/rides/:id/offers`. El sistema de ofertas/negociación utiliza:

1. **Modelo `DriverContact`** — Almacena contactos de conductores interesados en un ride, con `proposedPrice` y `proposalCount`
2. **Endpoints de mensajes**:
   - `POST /api/messages/propose-price` — Conductor propone precio
   - `POST /api/messages/accept-price` — Cliente acepta propuesta
   - `POST /api/messages/reject-price` — Cliente rechaza propuesta
3. **`GET /api/rides/:id/contacts`** — Lista los conductores que han contactado al cliente (retorna info básica, NO precios)

### Comportamiento Actual de la Tool
Hasta que se implemente el endpoint en el backend, esta tool devuelve un error claro:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"error\":\"Endpoint GET /api/rides/:id/offers pendiente de implementar en el backend\",\"details\":\"El sistema de ofertas usa los endpoints: POST /api/messages/propose-price, POST /api/messages/accept-price, POST /api/messages/reject-price\"}"
    }
  ],
  "isError": true
}
```

### Notas para Implementación Futura
- El endpoint backend debería consultar `DriverContact.find({ rideId, isActive: true })` y enriquecer con datos del `User` (firstName, lastName, imageUrl, rating del `Driver`)
- Alternativamente, se podría usar el endpoint existente `GET /api/rides/:id/contacts` y enriquecer con la información de precio desde `DriverContact`

---

## Tool 8: `accept_offer`

### Propósito
El cliente acepta la oferta de un conductor, asignando oficialmente el acarreo. El estado cambia a `accepted` y se activa el chat entre ambas partes.

### Parámetros de Entrada

| Parámetro | Tipo | Requerido | Validación | Descripción |
|-----------|------|-----------|------------|-------------|
| `authToken` | `string` | Sí | JWT válido de Clerk | Token de autenticación del usuario |
| `rideId` | `string` | Sí | Min 1 char | ID del acarreo |
| `driverId` | `string` | Sí | Min 1 char | ID del conductor (clerkId) |
| `agreedPrice` | `number` | No | Positivo | Precio acordado con el conductor. Si no se proporciona, se intenta obtener de la oferta más reciente |

### Formato de Respuesta

```typescript
{
  ride: {
    id: string,
    clientId: string,
    driverId: string,
    title: string,
    description: string,
    type: RideType,
    images: { url: string }[],
    pickupLocation: { address: string, coordinates: [number, number] },
    dropoffLocation: { address: string, coordinates: [number, number] },
    estimatedPrice: number,
    finalPrice?: number,       // Ahora tiene el agreedPrice
    status: 'accepted',
    chatEnabled: true,         // Chat activado
    createdAt: string,
    updatedAt: string
  }
}
```

### Endpoint Backend
`POST /api/rides/:id/accept`
- Body: `{ driverId, agreedPrice }`
- Retorna: El ride actualizado directamente

### Servicios del Backend Utilizados
- **Ruta**: `backend/src/routes/rides.ts` — `POST /:id/accept` handler
- **Middleware**: `authMiddleware`
- **Modelos**: `Ride.findByIdAndUpdate(...)`, `DriverContact.updateMany(...)`

### Flujo de Ejecución
1. El agente IA recibe `authToken`, `rideId`, `driverId` y opcionalmente `agreedPrice`
2. El MCP server extrae `authToken` de los args raw antes de la validación Zod
3. El handler valida parámetros con `acceptOfferSchema` (excluyendo `authToken`)
4. Se envía POST a `{BACKEND_URL}/api/rides/{rideId}/accept` con body `{ driverId, agreedPrice }` y el `authToken` del usuario como Bearer
5. El backend valida que:
   - El usuario autenticado es un driver (o admin)
   - El ride existe y está en estado `requested`
   - El driver no acepta su propio pedido
   - `agreedPrice` es válido
   - El ride sigue disponible (race condition)
6. El backend actualiza el ride: asigna `driverId`, cambia estado a `accepted`, activa chat
7. El backend desactiva todos los otros `DriverContact` del ride
8. Se transforma `_id` → `id` en la respuesta

### Permisos y Seguridad
- El backend verifica el token JWT de Clerk
- El backend requiere rol `driver` o `admin` para aceptar (no el cliente)
- El backend valida que el ride sigue en estado `requested`
- Previene que el conductor acepte su propio pedido
- Manejo de race condition: si otro driver ya aceptó, devuelve 409

### Notas Importantes
- El backend espera que el usuario autenticado sea un **driver**, no un cliente. Sin embargo, desde la perspectiva del MCP, el cliente está "aceptando la oferta" de un conductor. El flow real es que el driver usa `POST /api/rides/:id/accept`, pero el cliente usa `POST /api/messages/accept-price`.
- **Alternativa**: si el endpoint `POST /api/rides/:id/accept` requiere rol driver, el MCP podría llamar a `POST /api/messages/accept-price` en su lugar, que sí permite al cliente aceptar.
- El parámetro `agreedPrice` es opcional en el MCP pero obligatorio en el backend (`POST /api/rides/:id/accept`). Si no se proporciona en el MCP, se debe obtener de los datos de la oferta (DriverContact).

### Ejemplos de Uso

**Agente IA → MCP Server (vía `/api/rides/:id/accept`):**
```json
{
  "name": "accept_offer",
  "arguments": {
    "authToken": "jwt_de_clerk_del_usuario",
    "rideId": "abc123",
    "driverId": "driver_clerk_id",
    "agreedPrice": 250
  }
}
```

**Respuesta exitosa:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"ride\":{\"id\":\"abc123\",\"clientId\":\"user_clerk_id\",\"driverId\":\"driver_clerk_id\",\"title\":\"Mudanza a Tocumen\",\"estimatedPrice\":150,\"finalPrice\":250,\"status\":\"accepted\",\"chatEnabled\":true,\"createdAt\":\"2026-06-18T10:00:00Z\",\"updatedAt\":\"2026-06-18T11:00:00Z\"}}"
    }
  ]
}
```

### Posibles Errores

| Código | Mensaje | Causa |
|--------|---------|-------|
| `UNAUTHORIZED` | Token inválido o expirado | `authToken` inválido |
| `NOT_FOUND` | Ride no encontrado | El ID del ride no existe |
| `FORBIDDEN` | Solo conductores pueden aceptar pedidos | El usuario autenticado no es driver |
| `CONFLICT` | No puedes aceptar este pedido en su estado actual | El ride ya no está en `requested` |
| `CONFLICT` | El pedido ya fue aceptado por otro conductor | Race condition |
| `INVALID_INPUT` | Precio válido requerido | No se proporcionó `agreedPrice` y es obligatorio |
| `INVALID_INPUT` | No puedes aceptar tu propio pedido | El driver es el mismo que el cliente |

---

## Historial de Cambios

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-06-19 | Versión inicial — Documentación de 5 tools del cliente |
