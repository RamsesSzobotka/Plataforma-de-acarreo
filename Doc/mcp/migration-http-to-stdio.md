**NOTA**: Este plan de migración no fue ejecutado. La implementación final optó por mantener Streamable HTTP como transporte. Ver MCP-STADO.md para el diseño actual.

# Migración MCP: HTTP → stdio

> **Fecha**: 2026-06-24
> **Proyecto**: Plataforma de Acarreos (Carglyn)
> **Autor**: Análisis automatizado

## 1. Estado Actual

El MCP server está implementado con transporte **HTTP/SSE** usando
`WebStandardStreamableHTTPServerTransport` del SDK `@modelcontextprotocol/sdk` v1.6.1.

### Arquitectura actual

```
                    opencode.json
                 (type: "remote")
                       │
               HTTP POST/SSE GET
                       │
              ┌────────▼────────┐
              │  Bun/Hono       │
              │  :3000          │
              │                 │
              │  routes/mcp.ts  │
              │  ┌───────────┐  │
              │  │ MCP Auth  │  │ ← valida MCP_API_KEY header
              │  └─────┬─────┘  │       contra MongoDB
              │        │        │
              │  ┌─────▼─────┐  │
              │  │ Transport  │  │ ← WebStandardStreamableHTTPServerTransport
              │  │ (Map      │  │    1 sesión por sessionId
              │  │  sessions)│  │
              │  └─────┬─────┘  │
              │        │        │
              │  ┌─────▼─────┐  │
              │  │ McpServer │  │ ← createMcpServer(clerkId)
              │  │ + tools   │  │    tools registradas por closure
              │  └───────────┘  │
              └─────────────────┘
```

### Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `backend/src/routes/mcp.ts` | Ruta HTTP (`/api/mcp`) + middleware auth |
| `backend/src/mcp/server.ts` | `createMcpServer(clerkId)` + `validateMcpToken()` |
| `backend/src/mcp/tools/*.ts` | Handlers de cada tool |
| `backend/src/mcp/errors.ts` | Errores personalizados |
| `backend/src/mcp/types.ts` | Tipos compartidos |
| `backend/src/mcp/schemas.ts` | Schemas Zod |
| `C:\Users\ramse\.config\opencode\opencode.json` | `"carglyn"` config como `type: "remote"` |

### Flujo de autenticación

1. Usuario genera token via `POST /api/auth/mcp-token` (requiere sesión web)
2. Token se guarda en MongoDB como hash bcrypt + `clerkId`
3. Cada request MCP incluye `MCP_API_KEY` en headers
4. `validateMcpToken()` busca el token, lo compara con bcrypt, devuelve `clerkId`
5. `createMcpServer(clerkId)` devuelve un servidor con ese userId inyectado

---

## 2. Arquitectura Destino (stdio)

```
                    opencode.json
                 (type: "local")
                       │
                bun run stdio.ts
                       │
              ┌────────▼────────┐
              │  stdio.ts       │
              │  (entry point)  │
              │                 │
              │  Lee MCP_API_KEY│ ← de env variable
              │  de env         │
              └─────┬───────────┘
                    │
              ┌─────▼───────────┐
              │ validateMcpToken│ ← reusa misma función
              │ → clerkId       │
              └─────┬───────────┘
                    │
              ┌─────▼───────────┐
              │ StdioServerTrans│ ← @mcp/sdk nativo
              │ port            │
              └─────┬───────────┘
                    │
              ┌─────▼───────────┐
              │ McpServer       │
              │ + tools (same)  │ ← MISMO createMcpServer
              └─────────────────┘
```

### Lo que NO cambia

- ✅ Todos los tool handlers (`list-my-rides.ts`, `create-ride.ts`, etc.)
- ✅ `registerAllTools()` y el registry en `tools/index.ts`
- ✅ `validateMcpToken()` — misma función de auth
- ✅ `McpError`, schemas Zod, tipos
- ✅ `createMcpServer(clerkId)` — misma función, solo cambia el transporte

### Lo que SÍ cambia

| Componente | HTTP | stdio |
|------------|------|-------|
| Entry point | Ruta en Hono (`routes/mcp.ts`) | Script standalone (`stdio.ts`) |
| Transporte | `WebStandardStreamableHTTPServerTransport` | `StdioServerTransport` |
| Auth mechanism | Header HTTP `MCP_API_KEY` | Env variable `MCP_API_KEY` |
| Gestión sesiones | `Map<string, McpSession>` en memoria | No necesaria (1 proceso = 1 sesión) |
| Dependencia | Requiere servidor Bun/Hono corriendo | Independiente, solo necesita MongoDB |
| Config client | `type: "remote"`, `url` | `type: "local"`, `command`, `env` |

---

## 3. Plan de Implementación

### 3.1 Crear entry point stdio

**Archivo**: `backend/src/mcp/stdio.ts`

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer, validateMcpToken } from './server';

async function main() {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    console.error('❌ MCP_API_KEY no está configurada');
    process.exit(1);
  }

  const clerkId = await validateMcpToken(apiKey);
  if (!clerkId) {
    console.error('❌ Token MCP inválido');
    process.exit(1);
  }

  const server = createMcpServer(clerkId);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
```

### 3.2 Actualizar package.json

Agregar script:
```json
"mcp": "bun run src/mcp/stdio.ts"
```

### 3.3 Actualizar opencode.json

Cambiar de `remote` a `local`:

```json
"carglyn": {
  "enabled": true,
  "type": "local",
  "command": ["bun", "run", "mcp"],
  "cwd": "backend",
  "env": {
    "MCP_API_KEY": "mcp_ec9d0c28477c001e90e578e5ee6e7f662ddc0cc69c0bee12ffc8ceed98c9b535"
  }
}
```

### 3.4 Mantener HTTP (opcional)

`routes/mcp.ts` puede seguir existiendo para:
- Endpoint de diagnóstico `GET /api/mcp/status`
- Compatibilidad con otros clientes que prefieran HTTP
- No requiere cambios — coexiste sin problemas

---

## 4. Compatibilidad con Clientes MCP

| Cliente | HTTP | stdio | Notas |
|---------|------|-------|-------|
| **OpenCode** | ✅ type: "remote" | ✅ type: "local" | Soporta `env` y `cwd` en la config |
| **Claude Desktop** | ✅ url | ✅ command | Stdio requiere `command` + `args` en `claude_desktop_config.json` |
| **Copilot** | ✅ | ✅ | Soporta ambos en `.github/copilot/mcp.json` |
| **Codex (Cursor)** | ✅ type: "remote" | ✅ type: "stdio" | Soporta ambos en `.cursor/mcp.json` |

**Todos los clientes soportan stdio sin problemas.** No hay pérdida de compatibilidad.

---

## 5. Ventajas y Desventajas

### Ventajas de stdio

- ✅ **Sin dependencia del servidor HTTP** — el MCP funciona aunque el backend esté caído (para herramientas de solo lectura/plan)
- ✅ **Menor latencia** — no hay HTTP round-trip, comunicación directa por pipes
- ✅ **Arranque rápido** — Bun inicia en milisegundos
- ✅ **Aislamiento de sesión** — cada proceso es independiente, no hay sesiones compartidas en un Map
- ✅ **Config más portable** — funciona igual en todos los clientes MCP
- ✅ **Sin problemas de CORS/headers** — el SDK maneja todo el protocolo JSON-RPC

### Desventajas de stdio

- ❌ **Proceso separado** — consume un proceso de Bun por conexión MCP
- ❌ **Auth por env** — el token debe estar en variables de entorno, no se puede rotar sin reiniciar el proceso
- ❌ **Cliente controla el lifecycle** — el proceso lo inicia/termina el cliente MCP, no hay control manual
- ❌ **No se comparte cache** — cada proceso tiene su propia conexión a MongoDB y cache en memoria

### Veredicto

**Para este proyecto, stdio es la mejor opción.** La principal ventaja (independencia del servidor HTTP) pesa más que las desventajas. Bun es eficiente con recursos, y MongoDB connection pooling dentro de cada proceso es aceptable para sesiones individuales.

---

## 6. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Token en env variable = menos seguro que header | Medio | El token es el mismo, solo cambia el medio. Asegurar que `.env` esté en `.gitignore`. |
| Múltiples procesos = más conexiones MongoDB | Bajo | Bun maneja bien conexiones concurrentes. MongoDB driver tiene pool interno. |
| Cliente mata proceso inesperadamente | Bajo | Las operaciones de escritura deben ser idempotentes (ya lo son). |
| Cambio en config opencode.json requiere restart | Bajo | Solo al cambiar el token. Igual que con HTTP si cambiaba el header. |

---

## 7. Referencias

- [MCP Spec — Transport](https://spec.modelcontextprotocol.io/specification/basic/transports/)
- `@modelcontextprotocol/sdk` — `StdioServerTransport` exportado desde `server/stdio.js`
- Código actual: `backend/src/mcp/server.ts`, `backend/src/routes/mcp.ts`
