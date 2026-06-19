# AgentContext.md — Guía de Contexto para Agentes del MCP Server

> **Proyecto**: Plataforma de Acarreos — MCP Server
> **Versión**: 1.0
> **Propósito**: Brindar contexto completo a agentes de IA (Claude, OpenCode, Gemini) que implementen o mantengan tools del MCP Server.

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                     Agente IA (Claude/OpenCode)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MCP Protocol (stdio)                     │   │
│  │  list_tools / call_tool(name, arguments)              │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │                                            │
└─────────────────┼────────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────────┐
│              MCP Server (Bun + TypeScript)                    │
│  src/index.ts ──→ Register + Dispatch Tools                   │
│  src/tools/*.ts ──→ Tool Handlers (validan, llaman backend)   │
│  src/schemas.ts ──→ Zod validation schemas                    │
│  src/api-client.ts ──→ HTTP client to backend                 │
│  src/types.ts ──→ Shared TypeScript interfaces                │
│  src/errors.ts ──→ Error classes                              │
└──────────────────────────┬────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────┐
│              Backend (Bun + Hono + MongoDB)                    │
│  REST API en localhost:3000                                    │
│  Autenticación via Clerk JWT                                   │
└───────────────────────────────────────────────────────────────┘
```

### Stack
- **Runtime**: Bun 1.x
- **Lenguaje**: TypeScript (strict)
- **MCP SDK**: `@modelcontextprotocol/sdk` v1.6.1
- **Validación**: Zod v3.24
- **Transporte**: stdio (el servidor MCP se comunica por stdin/stdout)

### Flujo de Datos

```
Usuario → Agente IA → MCP Server → Backend REST → MongoDB
                                      ↑
                                   Clerk JWT (auth)
```

1. El usuario le pide al agente IA algo como "muestra mis acarreos"
2. El agente IA invoca la tool MCP `list_my_rides` con los argumentos necesarios
3. El MCP Server recibe la llamada, valida con Zod, y ejecuta el handler
4. El handler transforma los datos si es necesario y llama al backend REST
5. El backend procesa la request, consulta MongoDB y responde
6. El handler transforma la respuesta y la devuelve al agente IA
7. El agente IA interpreta la respuesta y se la presenta al usuario

---

## 2. Estructura de Archivos

```
mcp-server/
├── src/
│   ├── index.ts                  # Entry point + registro de tools
│   ├── api-client.ts             # Cliente HTTP para backend
│   ├── types.ts                  # Interfaces TypeScript
│   ├── schemas.ts                # Schemas Zod de validación
│   ├── errors.ts                 # Clases de error
│   ├── tools/
│   │   ├── index.ts              # Registry (registerTool, getTool, listTools)
│   │   ├── list-my-rides.ts      # 📌 Ramses
│   │   ├── create-ride.ts        # 📌 Ramses
│   │   ├── get-ride-details.ts   # 📌 Ramses
│   │   ├── view-offers.ts        # 📌 Ramses
│   │   ├── accept-offer.ts       # 📌 Ramses
│   │   ├── list-available-rides.ts      # 📌 Justin
│   │   ├── get-available-ride-details.ts # 📌 Justin
│   │   ├── send-offer.ts         # 📌 Justin
│   │   ├── update-ride-status.ts # 📌 Justin
│   │   └── get-ride-history.ts   # 📌 Justin
├── docs/
│   ├── PRD-MCP-Server.md          # PRD completo del MCP Server
│   ├── ASIGNACION.md              # Asignación de tools por desarrollador
│   ├── SIGUIENTE-SESION.md        # Estado de la sesión anterior
│   ├── ClientsTool.md             # Documentación de tools del cliente (Ramses)
│   └── AgentContext.md            # Este archivo — guía para agentes
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 3. Archivos Compartidos — Reglas Estrictas

| Archivo | Desarrollador | Qué contiene | Regla |
|---------|---------------|--------------|-------|
| `src/types.ts` | Ambos | Interfaces: `Ride`, `RideSummary`, `Offer`, `GeoLocation`, etc. | **NO modificar** sin coordinación. Si falta un tipo, agregarlo al final del archivo. |
| `src/schemas.ts` | Ambos | Schemas Zod para validación de cada tool | **Agregar schemas nuevos al final** del archivo. No modificar schemas existentes. |
| `src/errors.ts` | Ambos | Clase `McpError` + `httpErrorToMcpError()` | **NO modificar**. |
| `src/api-client.ts` | Ambos | Clase `ApiClient` con get/post/patch y retry | **NO modificar** sin coordinación. Si se necesita auth por request, extender con `authToken` opcional. |
| `src/tools/index.ts` | Ambos | Registry de tools (`registerTool`, `getTool`, `listTools`) | **NO modificar** — es el contrato. |
| `src/index.ts` | Ambos | Servidor MCP + registro de handlers | **Modificar** para registrar nuevas tools: importar handler + llamar `registerTool()`. |

### Estado Actual del Código (Sesión Inicial)

- `src/index.ts` — Servidor MCP funcional con `ListToolsRequestSchema` y `CallToolRequestSchema`. Las tools existentes (`getTool`, `listTools`) retornan nombres pero **ninguna tool está registrada aún**.
- `src/schemas.ts` — Schemas definidos para las 10 tools (listos para usar).
- `src/types.ts` — Interfaces completas para Ride, Offer, etc.
- `src/errors.ts` — Sistema de errores con `McpError` class.
- `src/api-client.ts` — Cliente HTTP con retry (2 reintentos, backoff exponencial).
- `src/tools/index.ts` — Registry con `registerTool`, `getTool`, `listTools`.
- **Tools handlers (archivos .ts en tools/)**: Todos **pendientes** — no existen aún.

---

## 4. Sistema de Autenticación

### Cómo funciona la auth en el backend

El backend usa **Clerk JWT tokens** para autenticación. El middleware `authMiddleware` verifica el token JWT y extrae el `userId` (clerkId) y `role`.

```typescript
// backend/src/middleware/auth.ts
const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const payload = await verifyToken(token); // Clerk SDK
  c.set('user', { clerkId: payload.sub, role: payload.role });
  await next();
};
```

### Estrategia de Auth para el MCP

**Decisión de diseño**: El MCP Server acepta un `authToken` (JWT de Clerk) del usuario **en cada llamada a tool**. Esto permite:

1. **Multi-usuario**: Diferentes usuarios pueden usar el mismo servidor MCP sin compartir sesión
2. **Seguridad**: El token se pasa directamente de Clerk al backend sin almacenamiento intermedio
3. **Simplicidad**: No se necesita estado de sesión en el MCP Server

**Implementación**:

```typescript
// Cada tool handler extrae authToken de los argumentos raw ANTES de la validación Zod
// El schema Zod NO incluye authToken — se maneja aparte

async function handler(args: z.infer<typeof mySchema>) {
  // El authToken ya fue extraído en index.ts y pasado como header
  const result = await apiClient.get('/path', { ...args, authToken });
}
```

**Modificación propuesta para `api-client.ts`**: Agregar soporte para `authToken` por request:

```typescript
async get<T>(path: string, params?: Record<string, ...>, authToken?: string): Promise<T> {
  return this.request<T>(url, { method: 'GET' }, authToken);
}

private getHeaders(authToken?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken ?? this.apiKey}`,
  };
}
```

### Variables de Entorno

```
MCP_API_KEY    - Token de autenticación (usado como fallback si no hay authToken)
BACKEND_URL    - URL del backend (default: http://localhost:3000)
NODE_ENV       - Entorno (default: development)
```

---

## 5. Patrón de Implementación de una Tool

Cada tool sigue este patrón:

```typescript
// src/tools/mi-tool.ts
import { z } from 'zod';
import { McpError } from '../errors';

// 1. Schema (definido en schemas.ts, importar desde ahí)
import { miToolSchema } from '../schemas';

// 2. Tipo inferido del schema
type Input = z.infer<typeof miToolSchema>;

// 3. Handler
export async function handleMiTool(
  input: Input,
  authToken: string
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    // Validar
    // Transformar datos si es necesario
    // Llamar al backend con authToken
    // Transformar respuesta
    // Retornar
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error inesperado: ' + error.message);
  }
}
```

### Registro en index.ts

```typescript
// En src/index.ts
import { registerTool } from './tools/index';
import { handleMiTool } from './tools/mi-tool';
import { miToolSchema } from './schemas';

registerTool({
  name: 'mi_tool',
  description: 'Descripción clara de lo que hace la tool',
  schema: miToolSchema,
  handler: async (args: any) => {
    const authToken = /* extraer de args */;
    const input = miToolSchema.parse(args);
    return handleMiTool(input, authToken);
  },
});
```

---

## 6. Mapeo de Datos: MCP ↔ Backend

### Formato de Ubicaciones

El backend usa el formato **GeoJSON** anidado:
```json
{
  "pickupLocation": {
    "address": "Calle 50, Panamá",
    "type": "Point",
    "coordinates": [-79.5199, 8.9824]  // [lng, lat]
  }
}
```

Las tools MCP del lado cliente reciben campos planos:
```json
{
  "pickupAddress": "Calle 50, Panamá",
  "pickupLat": 8.9824,
  "pickupLng": -79.5199
}
```

**El handler debe transformar** campos planos → formato GeoJSON antes de enviar al backend.

### Transformación _id → id

El backend (MongoDB/Mongoose) serializa los documentos con `_id`:
```json
{
  "_id": { "$oid": "abc123" },
  "title": "...",
  ...
}
```

El MCP Server debe transformar a:
```json
{
  "id": "abc123",
  "title": "...",
  ...
}
```

Usar helper:
```typescript
function transformRide(ride: any): Ride {
  return {
    id: ride._id?.toString() ?? ride.id,
    ...rest
  };
}
```

### Respuestas Paginadas

Backend retorna:
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

MCP Server debe transformar y devolver datos planos y útiles al agente IA.

### Normalización de Tipos

El backend usa `'electrodomesticos'` (sin acento), el MCP usa `'electrodomésticos'` (con acento).

```typescript
const typeMap: Record<string, string> = {
  'electrodomésticos': 'electrodomesticos',
  'mudanza': 'mudanza',
  'muebles': 'muebles',
  'productos': 'productos',
  'otros': 'otros',
};
```

---

## 7. Sistema de Errores

### Clase McpError

```typescript
new McpError(code, message, httpStatus, retryable)

// Códigos disponibles:
'UNAUTHORIZED'     - 401 - Token inválido
'FORBIDDEN'        - 403 - Sin permisos
'NOT_FOUND'        - 404 - Recurso no existe
'INVALID_INPUT'    - 400 - Datos inválidos
'CONFLICT'         - 409 - Estado no permite operación
'BACKEND_ERROR'    - 500 - Error interno del backend
'BACKEND_UNAVAILABLE' - 503 - Backend caído (retryable)
```

### Mapeo HTTP → McpError

`httpErrorToMcpError(status, body)` mapea automáticamente códigos HTTP a McpError.

### Manejo en index.ts

Los errores `McpError` se capturan en `CallToolRequestSchema` y se devuelven como:
```json
{
  "content": [{ "type": "text", "text": "{\"code\":\"...\",\"message\":\"...\"}" }],
  "isError": true
}
```

---

## 8. Endpoints del Backend

### Rides

| Método | Path | Auth | Descripción | Estado |
|--------|------|------|-------------|--------|
| `GET` | `/api/rides` | Sí | Listar rides (filtros: status, clientId, driverId) | ✅ |
| `GET` | `/api/rides/available` | Sí | Listar rides disponibles para driver | ✅ |
| `POST` | `/api/rides` | Sí | Crear ride | ✅ |
| `GET` | `/api/rides/:id` | Sí | Obtener ride por ID | ✅ |
| `PATCH` | `/api/rides/:id` | Sí | Actualizar ride | ✅ |
| `PATCH` | `/api/rides/:id/status` | Sí | Cambiar estado | ✅ |
| `POST` | `/api/rides/:id/accept` | Sí | Aceptar ride (driver) | ✅ |
| `POST` | `/api/rides/:id/start` | Sí | Iniciar viaje | ✅ |
| `POST` | `/api/rides/:id/delivery-photo` | Sí | Subir foto de entrega | ✅ |
| `POST` | `/api/rides/:id/confirm-delivery` | Sí | Confirmar entrega | ✅ |
| `POST` | `/api/rides/:id/cancel` | Sí | Cancelar ride | ✅ |
| `POST` | `/api/rides/:id/rate` | Sí | Calificar (1-5) | ✅ |
| `POST` | `/api/rides/:id/payment-method` | Sí | Guardar método de pago | ✅ |
| `GET` | `/api/rides/:id/contacts` | Sí | Ver contactos del ride (drivers interesados) | ✅ |
| `GET` | `/api/rides/:id/offers` | Sí | Ver ofertas del ride | ❌ No existe |

### Messages

| Método | Path | Auth | Descripción | Estado |
|--------|------|------|-------------|--------|
| `POST` | `/api/messages/propose-price` | Sí | Conductor propone precio | ✅ |
| `POST` | `/api/messages/accept-price` | Sí | Cliente acepta propuesta de precio | ✅ |
| `POST` | `/api/messages/reject-price` | Sí | Cliente rechaza propuesta de precio | ✅ |

---

## 9. Modelos Clave del Backend

### Ride (simplificado)

```typescript
{
  _id: ObjectId,
  clientId: string,           // clerkId del cliente
  driverId?: string,          // clerkId del conductor
  title: string,
  description: string,
  type: 'mudanza' | 'electrodomesticos' | 'muebles' | 'productos' | 'otros',
  images: [{ url, publicId? }],
  pickupLocation: { address: string, type: 'Point', coordinates: [lng, lat] },
  dropoffLocation: { address: string, type: 'Point', coordinates: [lng, lat] },
  estimatedPrice: number,
  finalPrice?: number,
  packages?: number,
  notes?: string,
  preferredDate?: Date,
  status: RideStatus,
  chatEnabled: boolean,
  stripePaymentMethodId?: string,
  paymentIntentId?: string,
  createdAt: Date,
  updatedAt: Date,
}
```

### DriverContact

```typescript
{
  _id: ObjectId,
  rideId: string,
  driverId: string,
  proposedPrice: number,
  proposalCount: number,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date,
}
```

---

## 10. Convenciones y Buenas Prácticas

### Nombres
- Tools: `snake_case` (e.g., `list_my_rides`)
- Archivos: `kebab-case` (e.g., `list-my-rides.ts`)
- Variables: `camelCase`
- Tipos/Interfaces: `PascalCase`

### Manejo de Errores
- Siempre capturar errores en handlers
- Errores de backend se mapean con `httpErrorToMcpError()`
- Errores inesperados se envuelven en `McpError('BACKEND_ERROR', ...)`
- No exponer stack traces al agente IA

### Validación
- Usar schemas Zod de `schemas.ts` — ya están definidos
- No duplicar validación en el handler
- Si se necesita un schema nuevo, agregarlo al final de `schemas.ts`

### Transformación de Datos
- _id → id : siempre transformar
- GeoJSON campos planos ↔ anidados : transformar en handler
- Fechas: formatear a ISO string si vienen como Date
- Paginación: backend retorna `{ data, pagination }`, transformar a la estructura que necesite la tool

### Estilo de Código
- Comentarios JSDoc en funciones públicas
- TypeScript estricto (no usar `any`)
- Usar `async/await` consistente
- Nombres descriptivos (no abreviaturas crípticas)

---

## 11. Gotchas y Trampas Comunes

1. **Auth en accept_offer**: El backend `POST /api/rides/:id/accept` espera que el autenticado sea un **driver** (role check `currentUser.role !== 'driver'`). Para el cliente, usar `POST /api/messages/accept-price` en su lugar.

2. **Tipo 'electrodomesticos'**: El backend valida tipos sin acento, pero el MCP los define con acento. Normalizar antes de enviar.

3. **images en create_ride**: El backend requiere al menos 1 imagen. Si el MCP no soporta subida de imágenes, se debe primero crear el ride sin imágenes y luego usar otro método para subirlas.

4. **stripePaymentMethodId**: El backend requiere esto para crear un ride. Busca en el perfil del usuario si no se proporciona en el body.

5. **Race condition en accept_offer**: El backend usa `findByIdAndUpdate` con condición para prevenir race conditions. Si dos drivers aceptan simultáneamente, solo uno tendrá éxito.

6. **Formato de fechas**: Mongoose devuelve objetos Date. El MCP debe serializar a ISO string.

7. **Backend usa módulo ESM**: `"type": "module"` en package.json. Los imports usan sintaxis ESM.

8. **El MCP Server no tiene estado**: No asumir sesiones entre llamadas de tools. Cada llamada es independiente.

---

## 12. Comandos Útiles

```bash
# Desarrollo
bun run dev          # Iniciar MCP server con watch mode

# TypeScript
bun run typecheck    # Verificar tipos (tsc --noEmit)

# Producción
bun run start        # Iniciar MCP server (sin watch)

# Backend (para pruebas locales)
cd ../backend
bun run dev          # Iniciar backend
```

---

## 13. Herramientas Asignadas

### 🧑‍💼 Ramses Szobotka — Cliente-side

| # | Tool | Endpoint Backend | Handler |
|---|------|------------------|---------|
| 1 | `list_my_rides` | `GET /api/rides?clientId={id}` | `src/tools/list-my-rides.ts` |
| 2 | `create_ride` | `POST /api/rides` | `src/tools/create-ride.ts` |
| 3 | `get_ride_details` | `GET /api/rides/:id` | `src/tools/get-ride-details.ts` |
| 7 | `view_offers` | `GET /api/rides/:id/offers` ❌ | `src/tools/view-offers.ts` |
| 8 | `accept_offer` | `POST /api/rides/:id/accept` | `src/tools/accept-offer.ts` |

### 🚚 Justin Barrios — Conductor-side

| # | Tool | Endpoint Backend | Handler |
|---|------|------------------|---------|
| 4 | `list_available_rides` | `GET /api/rides/available` | `src/tools/list-available-rides.ts` |
| 5 | `get_available_ride_details` | `GET /api/rides/:id` | `src/tools/get-available-ride-details.ts` |
| 6 | `send_offer` | `POST /api/rides/:id/accept` | `src/tools/send-offer.ts` |
| 9 | `update_ride_status` | `PATCH /api/rides/:id/status` | `src/tools/update-ride-status.ts` |
| 10 | `get_ride_history` | `GET /api/rides?driverId={id}` | `src/tools/get-ride-history.ts` |

---

*Este documento debe mantenerse actualizado a medida que evoluciona el proyecto.*
