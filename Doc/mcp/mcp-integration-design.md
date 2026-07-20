# mcp-integration-design.md — OBSOLETO
Ver: MCP-STADO.md para el estado actual.

---

# MCP Integration Design — Carglyn MCP

> **Estado**: Aprobado para implementación
> **Versión**: 1.0
> **Fecha**: 2026-06-19

## Objetivo

Integrar el MCP Server dentro del backend (Bun + Hono) para que los usuarios puedan conectar OpenCode y Claude Desktop a la plataforma mediante tokens generados desde la web.

## Arquitectura

```
Backend (Bun + Hono) — Un solo servicio
├── REST API (existente)
│   ├── /api/auth, /api/rides, /api/users, etc.
├── MCP Endpoint (nuevo)
│   ├── GET  /api/mcp          ← SSE handshake
│   └── POST /api/mcp/messages  ← tool calls
├── MCP Token (nuevo en auth.ts)
│   └── POST /api/auth/mcp-token ← genera token para usuario autenticado
└── WebSocket (existente)
    └── /ws/chat/:rideId
```

## Organización del Código

```
backend/
├── src/
│   ├── mcp/                          ← NUEVO
│   │   ├── server.ts                  ← MCP Server + registro de tools
│   │   ├── schemas.ts                 ← Desde mcp-server/src/schemas.ts
│   │   ├── types.ts                   ← Desde mcp-server/src/types.ts
│   │   ├── errors.ts                  ← Desde mcp-server/src/errors.ts
│   │   └── tools/                     ← 10 tools (refactor a DB directa)
│   │       ├── index.ts              ← Tool registry
│   │       ├── list-my-rides.ts
│   │       ├── create-ride.ts
│   │       ├── get-ride-details.ts
│   │       ├── view-offers.ts
│   │       ├── accept-offer.ts
│   │       ├── list-available-rides.ts
│   │       ├── get-available-ride-details.ts
│   │       ├── send-offer.ts
│   │       ├── update-ride-status.ts
│   │       └── get-ride-history.ts
│   ├── routes/
│   │   ├── mcp.ts                    ← NUEVO: GET/POST /api/mcp
│   │   └── auth.ts                   ← + POST /api/auth/mcp-token
│   ├── models/
│   │   └── mcp-token.ts              ← NUEVO: { clerkId, tokenHash, createdAt }
│   └── index.ts                      ← + route mcp
│
mcp-server/                            ← Sigue existiendo (wrapper stdio local)
├── src/
│   └── index.ts                       ← Thin stdio wrapper
├── package.json
```

## Flujo de Autenticación

1. Usuario logueado → /settings/mcp → "Generate Token"
2. POST /api/auth/mcp-token (con Clerk JWT)
3. Backend genera UUID, hashea (bcrypt), guarda en MongoDB
4. Devuelve token plano al frontend (única vez que se muestra)
5. Usuario copia token → configura OpenCode/Claude
6. OpenCode: GET /api/mcp con header MCP_API_KEY
7. Backend valida token → extrae clerkId → conexión SSE
8. Cada tool call usa clerkId para consultas DB directas

## Gestión de Tokens

- **Un token por usuario**: Generar nuevo invalida el anterior
- **Sin expiración**: El token dura hasta que el usuario genere uno nuevo
- **Almacenamiento**: `tokenHash` con bcrypt (hash + salt)
- **Índice único**: `clerkId` como unique index

## Página Web: /settings/mcp

Tabs: **OpenCode** | **Claude Desktop**
Sub-tabs (en ambos): **Localhost** | **Production**

Sección token compartida:
- Estado actual del token
- Botón "Generate New Token" (con confirmación)
- Token mostrado una vez con botón copiar

Snippets de configuración para OpenCode/Claude según entorno.

## Cambios en las Tools

Las tools MCP dejan de usar `api-client.ts` (que llamaba REST) y pasan a llamar MongoDB directamente:

```typescript
// Antes:
const response = await apiClient.get('/api/rides', { clientId: userId }, authToken);

// Después:
const cursor = db.collection('rides').find({ clientId: userId, ...filters })
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit);
```

Cada tool recibe `userId` decodificado del token MCP.

## Dependencias Nuevas

- `backend/package.json`: + `@modelcontextprotocol/sdk` (ya existe en mcp-server/)
- `frontend/package.json`: Sin cambios (react-router ya existe)

## Transportes Soportados

| Transporte | Uso | Cómo |
|-----------|-----|------|
| stdio | Local dev / testing | `bun run mcp-server/src/index.ts` |
| HTTP/SSE | Producción + localhost | `GET /api/mcp` (integrado en backend) |
