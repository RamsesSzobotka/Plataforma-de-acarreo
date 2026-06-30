# MCP — Plataforma de Acarreos

## Estado
**COMPLETADO** ✅

## Visión
MCP (Model Context Protocol) permite a agentes de IA (OpenCode, Claude, etc.) 
operar directamente sobre la plataforma de acarreos como un usuario autenticado.
El agente puede criar rides, ver ofertas, aceptar conductores, iniciar viajes, etc.
desde cualquier cliente MCP compatible.

## Transporte
- **Protocolo**: Streamable HTTP
- **Endpoint**: `POST /api/mcp`
- **Status**: `GET /api/mcp/status`
- **Auth**: Header `MCP_API_KEY: mcp_<tokenId>_<secret>`

## Token MCP
- Uno por usuario
- Formato: `mcp_<tokenId>_<secret>`
- Generado desde: `POST /api/auth/mcp-token`
- Revocado desde: `DELETE /api/auth/mcp-token`
- Estado: `GET /api/auth/mcp-token/status`
- Los tokens son permanentes hasta revocación explícita

## Modelo de Ofertas
El flujo de ofertas es:
1. Cliente cria ride → estado `requested`
2. Conductor propone precio → `Offer` con status `pending`
3. Cliente acepta una oferta → `Offer` status `accepted`, ride pasa a `accepted`
4. Otras ofertas → `rejected`
5. Conductor inicia viaje → ride `in_progress`
6. Conductor sube foto → `deliveryPhoto` en ride
7. Cliente confirma entrega → ride `completed`
8. Cliente paga → ride `paid`
9. Ambos califican

Modelo `Offer`:
- `rideId`, `clientId`, `driverId`
- `amount` (precio propuesto)
- `message` (mensaje opcional del conductor)
- `status`: `pending` | `accepted` | `rejected` | `cancelled`
- Índice único en `{rideId, driverId}` — un conductor, una oferta activa por ride

## Estados del Ride
`requested` → `accepted` → `in_progress` → `completed` → `paid`
                ↘ `cancelled`      ↘ `cancelled`
`requested` → `cancelled` (cliente puede cancelar)

## Herramientas — Cliente (9 tools)
| Tool | Descripción |
|------|-------------|
| `list_my_rides` | Lista mis rides (cliente o conductor). Incluye perfil del conductor asignado. |
| `create_ride` | Crea un nuevo ride en estado `requested`. Requiere imágenes (subir primero con `/api/upload`) |
| `get_ride_details` | Detalle completo de un ride por ID |
| `view_offers` | Ver ofertas pendientes de un ride (solo el cliente dueño) |
| `accept_offer` | Aceptar una oferta. El cliente elige cuál. Transacción atómica: oferta aceptada, ride aceptado, otras ofertas rechazadas |
| `confirm_delivery` | Cliente confirma entrega. Ride → `completed` |
| `cancel_ride` | Cliente cancela en `requested`. Conductor cancela en `accepted` con motivo |
| `rate_service` | Calificar 1-5 después de `paid`. Solo una calificación por persona por ride |
| `get_public_driver_profile` | Perfil público de un conductor por ID |

## Herramientas — Conductor (7 tools)
| Tool | Descripción |
|------|-------------|
| `list_available_rides` | Lista rides disponibles (`requested`, sin conductor asignado). Si no está verificado → `canApply: false` |
| `propose_price` | Crear o actualizar una oferta. Solo conductores verificados. Si ya existe oferta pendiente para este ride, la actualiza |
| `send_message` | Enviar mensaje en un ride. Conductor debe tener oferta (pending/accepted) o ser el conductor asignado |
| `start_trip` | Iniciar viaje. Solo conductor verificado asignado en ride `accepted` → `in_progress` |
| `upload_delivery_photo` | Subir URL de foto de entrega. Solo conductor asignado en `in_progress`. No cambia estado a `completed` |
| `get_payment_history` | Historial de rides pagados (`paid`). Muestra `finalPrice`, `platformFee` (10%), `driverAmount` (90%) |
| `get_driver_profile` | Mi perfil de conductor con permisos según `verificationStatus` |

## Verificación del Conductor
| Estado | `list_available_rides` | `propose_price` | `start_trip` | `upload_delivery_photo` |
|--------|----------------------|-----------------|--------------|------------------------|
| `pending` | ve | no | no | no |
| `in_review` | ve | no | no | no |
| `verified` | ✅ | ✅ | ✅ | ✅ |
| `rejected` | ve (canApply=false) | no | no | no |
| `suspended` | vacío | no | no | no |

## Seguridad
- Token lookup O(1) por `tokenId` (índice único)
- bcrypt del token completo
- Sesión MCP validada contra `clerkId` — no se pueden cruzar sesiones
- Rate limiting: 300 req/min por IP en endpoints MCP
- Headers CORS: `MCP_API_KEY`, `mcp-session-id` permitidos

## Auditoría
Todas las acciones sensibles se registran en `audit_logs`:
- `mcp.token.created` / `mcp.token.revoked`
- `mcp.tool.*` para cada tool que modifica datos
Campos: `clerkId`, `role`, `action`, `toolName`, `resourceId`, `success`, `errorCode`, `durationMs`, `createdAt`

## Configuración OpenCode
```json
{
  "mcpServers": {
    "carglyn": {
      "enabled": true,
      "type": "remote",
      "transport": "streamable-http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "MCP_API_KEY": "TU_TOKEN_AQUI"
      }
    }
  }
}
```

## Archivo Principal
Este documento reemplaza:
- `PRD-MCP-Server.md` (desactualizado)
- `ASIGNACION.md` (desactualizado)
- `AgentContext.md` (legacy)
- `ClientsTool.md` (legacy)
- `mcp-integration-design.md` (legacy)

## Issues Resueltos
- ISSUE-001: clientName/driverName en `list_my_rides` — ✅ corregido
- ISSUE-002: `accept_offer` — ✅ corregido con modelo Offer y transacción atómica
- ISSUE-003: `create_ride` — ✅ listo para producción
