# Próxima Sesión — Implementación de Tools del MCP Server

## Estado Actual (Final de Sesión 1)

### ✅ Completado

| Elemento | Archivo |
|----------|---------|
| PRD completo | `docs/PRD-MCP-Server.md` |
| package.json | `package.json` |
| tsconfig.json | `tsconfig.json` |
| .env.example | `.env.example` |
| .gitignore | `.gitignore` |
| Errores personalizados | `src/errors.ts` |
| Tipos compartidos | `src/types.ts` |
| Cliente HTTP | `src/api-client.ts` |
| Schemas Zod (validación) | `src/schemas.ts` |
| Entry point del servidor | `src/index.ts` |
| Registry de tools | `src/tools/index.ts` |

### ⏳ Pendiente para Próxima Sesión

#### Fase 1: Handlers de tools (4 tools de lectura)

Crear los handlers de las tools que usan endpoints GET existentes:

1. **`src/tools/list-my-rides.ts`** — Tool 1: `list_my_rides`
2. **`src/tools/create-ride.ts`** — Tool 2: `create_ride`
3. **`src/tools/get-ride-details.ts`** — Tool 3: `get_ride_details`
4. **`src/tools/list-available-rides.ts`** — Tool 4: `list_available_rides`
5. **`src/tools/get-available-ride-details.ts`** — Tool 5: `get_available_ride_details`
6. **`src/tools/send-offer.ts`** — Tool 6: `send_offer`
7. **`src/tools/view-offers.ts`** — Tool 7: `view_offers`
8. **`src/tools/accept-offer.ts`** — Tool 8: `accept_offer`
9. **`src/tools/update-ride-status.ts`** — Tool 9: `update_ride_status`
10. **`src/tools/get-ride-history.ts`** — Tool 10: `get_ride_history`

#### Fase 2: Endpoints faltantes en el backend

El MCP server necesita que el backend tenga estos endpoints (algunos pueden no existir aún):

| Endpoint | Tools que lo usan | Estado |
|----------|-------------------|--------|
| `POST /api/auth/mcp-token` | Todas (generar token) | ❌ No existe |
| `POST /api/rides/:id/offers` | Tool 6 (send_offer) | ❌ No existe |
| `GET /api/rides/:id/offers` | Tool 7 (view_offers) | ❌ No existe |

#### Fase 3: Pruebas

- Probar el servidor con `bun run src/index.ts`
- Verificar que las tools aparecen en el listado
- Conectar con Claude Desktop u OpenCode
- Probar cada tool con llamadas reales al backend

#### Fase 4: Configuración del contenedor (Opcional)

- `Dockerfile` para el MCP server
- Estrategia de deploy

## Instrucciones para la Próxima Sesión

1. Instalar dependencias: `cd mcp-server && bun install`
2. Crear token MCP en el backend (o hardcodear uno temporal para desarrollo)
3. Implementar los 10 handlers de tools (un archivo por tool)
4. Probar que el servidor inicia: `bun run src/index.ts`
5. Verificar con `bun run --watch` que los changes se reflejan
6. Probar conexión con el agente IA configurando el MCP server

## Referencias

- [MCP SDK TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Spec](https://spec.modelcontextprotocol.io/)
- [Bun Runtime](https://bun.sh/)
- PRD completo: `docs/PRD-MCP-Server.md`
