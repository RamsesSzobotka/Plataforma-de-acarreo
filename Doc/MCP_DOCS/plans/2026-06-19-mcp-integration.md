# MCP Integration Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement this plan. Tasks run in parallel phases. READ each task's "Context" section first for dependencies.

**Goal:** Integrate MCP Server into the backend (HTTP/SSE) + add token management + frontend settings page.

**Architecture:** MCP SDK runs as part of the backend (Bun+Hono). Tools call MongoDB directly using `userId` extracted from custom MCP tokens. The frontend at `/settings/mcp` allows users to generate tokens and see config snippets. The existing `mcp-server/` becomes optional stdio wrapper.

**Tech Stack:** Bun, Hono, MongoDB, @modelcontextprotocol/sdk, React

---

## File Structure

### Files to CREATE:
| File | Purpose |
|------|---------|
| `backend/src/models/mcp-token.ts` | Mongoose model for MCP tokens |
| `backend/src/mcp/server.ts` | MCP Server setup + tool registration |
| `backend/src/mcp/schemas.ts` | Zod schemas (copy from mcp-server/src/schemas.ts, add mcp-token type) |
| `backend/src/mcp/types.ts` | TypeScript interfaces (copy from mcp-server/src/types.ts) |
| `backend/src/mcp/errors.ts` | Error classes (copy from mcp-server/src/errors.ts) |
| `backend/src/mcp/tools/index.ts` | Tool registry (copy from mcp-server/src/tools/index.ts, remove mcp-token tool) |
| `backend/src/mcp/tools/list-my-rides.ts` | Refactored: uses DB direct |
| `backend/src/mcp/tools/create-ride.ts` | Refactored: uses DB direct |
| `backend/src/mcp/tools/get-ride-details.ts` | Refactored: uses DB direct |
| `backend/src/mcp/tools/view-offers.ts` | Refactored: uses DB direct |
| `backend/src/mcp/tools/accept-offer.ts` | Refactored: uses DB direct |
| `backend/src/mcp/tools/list-available-rides.ts` | Refactored: uses DB direct |
| `backend/src/mcp/tools/get-available-ride-details.ts` | Refactored: uses DB direct |
| `backend/src/mcp/tools/send-offer.ts` | Refactored: uses DB direct |
| `backend/src/mcp/tools/update-ride-status.ts` | Refactored: uses DB direct |
| `backend/src/mcp/tools/get-ride-history.ts` | Refactored: uses DB direct |
| `backend/src/routes/mcp.ts` | HTTP/SSE endpoint |
| `frontend/src/pages/SettingsMcp.tsx` | MCP settings page |

### Files to MODIFY:
| File | Change |
|------|--------|
| `backend/src/routes/auth.ts` | Add `POST /api/auth/mcp-token` endpoint |
| `backend/src/index.ts` | Add `app.route('/api/mcp', mcp)` |
| `backend/package.json` | Add `@modelcontextprotocol/sdk` |
| `frontend/src/App.tsx` | Add route `/settings/mcp` |

### Files to READ (for reference):
| File | Purpose |
|------|---------|
| `backend/src/db/mongo.ts` | Understand DB connection pattern |
| `backend/src/middleware/auth.ts` | Auth middleware pattern |
| `backend/src/routes/auth.ts` | Existing auth routes to extend |
| `backend/src/index.ts` | Route registration pattern |
| `mcp-server/src/schemas.ts` | Copy source for schemas |
| `mcp-server/src/types.ts` | Copy source for types |
| `mcp-server/src/errors.ts` | Copy source for errors |
| `mcp-server/src/tools/index.ts` | Copy source for tool registry |
| `mcp-server/src/tools/list-my-rides.ts` | Copy source + refactor example |
| `mcp-server/src/index.ts` | Understand tool registration pattern |
| `frontend/src/App.tsx` | Route registration pattern |
| `frontend/src/pages/*.tsx` | UI pattern reference |

---

## Phase 1: Parallel Tasks (no dependencies)

### Task 1: Token Model + Auth Endpoint

**Context:** This creates the MCP token storage and generation endpoint. Independent of all other tasks. Uses existing backend patterns (Mongoose-style via `db.collection()`, auth middleware for Clerk JWT verification).

**Files:**
- Create: `backend/src/models/mcp-token.ts`
- Modify: `backend/src/routes/auth.ts` (add endpoint)
- Modify: `backend/package.json` (add dependency)

- [ ] **Step 1: Add MCP SDK dependency to backend**

Modify `backend/package.json`:
```json
"dependencies": {
  ...
  "@modelcontextprotocol/sdk": "^1.6.1"
}
```

- [ ] **Step 2: Create MCP Token model**

Create `backend/src/models/mcp-token.ts`:
```typescript
import { db } from '../db/mongo';

export interface McpToken {
  clerkId: string;
  tokenHash: string;
  lastUsedAt?: Date;
  createdAt: Date;
}

export const MCP_TOKENS_COLLECTION = 'mcp_tokens';

export async function createMcpTokenIndexes() {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  await collection.createIndex({ clerkId: 1 }, { unique: true });
  await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 0 }); // No expiration
}

export async function saveMcpToken(clerkId: string, tokenHash: string): Promise<void> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  // Replace existing token if any (upsert)
  await collection.updateOne(
    { clerkId },
    { $set: { tokenHash, createdAt: new Date() }, $unset: { lastUsedAt: '' } },
    { upsert: true }
  );
}

export async function getMcpToken(clerkId: string): Promise<McpToken | null> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  return collection.findOne({ clerkId });
}

export async function updateTokenLastUsed(clerkId: string): Promise<void> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  await collection.updateOne({ clerkId }, { $set: { lastUsedAt: new Date() } });
}

export async function deleteMcpToken(clerkId: string): Promise<void> {
  const collection = db.collection<McpToken>(MCP_TOKENS_COLLECTION);
  await collection.deleteOne({ clerkId });
}
```

- [ ] **Step 3: Add token generation endpoint to auth.ts**

Read `backend/src/routes/auth.ts` first, then add this endpoint:

```typescript
// Add imports at top
import crypto from 'crypto';
import { compare, hash } from 'bcryptjs';
import { saveMcpToken, deleteMcpToken, getMcpToken, createMcpTokenIndexes } from '../models/mcp-token';

// Add endpoint after the existing routes
auth.post('/mcp-token', authMiddleware, async (c) => {
  const user = c.get('user');
  const clerkId = user.clerkId;

  try {
    // Generate a secure random token
    const rawToken = 'mcp_' + crypto.randomBytes(32).toString('hex');
    
    // Hash the token for storage
    const tokenHash = await hash(rawToken, 10);
    
    // Save token (replaces any existing token for this user)
    await saveMcpToken(clerkId, tokenHash);
    
    return c.json({
      data: {
        token: rawToken,
        message: 'Guarda este token. No lo volveremos a mostrar.',
      },
    });
  } catch (error) {
    console.error('Error generating MCP token:', error);
    return c.json({ error: 'Error al generar token' }, 500);
  }
});

// Add a GET endpoint to check if token exists
auth.get('/mcp-token/status', authMiddleware, async (c) => {
  const user = c.get('user');
  const token = await getMcpToken(user.clerkId);
  return c.json({
    data: {
      hasToken: !!token,
      createdAt: token?.createdAt,
      lastUsedAt: token?.lastUsedAt,
    },
  });
});

// Add a DELETE endpoint to revoke token
auth.delete('/mcp-token', authMiddleware, async (c) => {
  const user = c.get('user');
  await deleteMcpToken(user.clerkId);
  return c.json({ data: { message: 'Token revocado' } });
});
```

- [ ] **Step 4: Run typecheck**

```bash
cd backend && bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/src/models/mcp-token.ts backend/src/routes/auth.ts backend/bun.lock
git commit -m "feat: add MCP token model and auth endpoints"
```

---

### Task 2: MCP Server Setup + Tools Migration

**Context:** This creates the MCP server core and migrates all 10 tools from `mcp-server/src/` to `backend/src/mcp/`. Tools are refactored to use MongoDB directly instead of calling REST API via `api-client.ts`.

**References:**
- `mcp-server/src/schemas.ts` → copy to `backend/src/mcp/schemas.ts`
- `mcp-server/src/types.ts` → copy to `backend/src/mcp/types.ts`
- `mcp-server/src/errors.ts` → copy to `backend/src/mcp/errors.ts`
- `mcp-server/src/tools/index.ts` → copy to `backend/src/mcp/tools/index.ts`
- `backend/src/db/mongo.ts` → DB connection pattern
- Import `db` from `'../../db/mongo'` in tool handlers

**Files:**
- Create: `backend/src/mcp/server.ts`
- Create: `backend/src/mcp/schemas.ts`
- Create: `backend/src/mcp/types.ts`
- Create: `backend/src/mcp/errors.ts`
- Create: `backend/src/mcp/tools/index.ts`
- Create: `backend/src/mcp/tools/list-my-rides.ts`
- Create: `backend/src/mcp/tools/create-ride.ts`
- Create: `backend/src/mcp/tools/get-ride-details.ts`
- Create: `backend/src/mcp/tools/view-offers.ts`
- Create: `backend/src/mcp/tools/accept-offer.ts`
- Create: `backend/src/mcp/tools/list-available-rides.ts`
- Create: `backend/src/mcp/tools/get-available-ride-details.ts`
- Create: `backend/src/mcp/tools/send-offer.ts`
- Create: `backend/src/mcp/tools/update-ride-status.ts`
- Create: `backend/src/mcp/tools/get-ride-history.ts`

- [ ] **Step 1: Copy schema files from mcp-server**

Read `mcp-server/src/schemas.ts` and copy its contents to `backend/src/mcp/schemas.ts`. The content is Zod schemas and doesn't need changes.

Read `mcp-server/src/types.ts` and copy to `backend/src/mcp/types.ts`. No changes needed.

Read `mcp-server/src/errors.ts` and copy to `backend/src/mcp/errors.ts`. No changes needed.

Read `mcp-server/src/tools/index.ts` and copy to `backend/src/mcp/tools/index.ts`. No changes needed (it's just a registry).

- [ ] **Step 2: Create MCP server.ts**

Create `backend/src/mcp/server.ts`:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError as SdkMcpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { McpError as CustomMcpError } from './errors';
import { getTool, listTools } from './tools/index';
import { getMcpToken, updateTokenLastUsed } from '../models/mcp-token';
import { compare } from 'bcryptjs';

export function createMcpServer() {
  const mcpServer = new Server(
    {
      name: 'carglyn-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // List Tools handler
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = listTools();
    return {
      tools: tools.map((t) => {
        const jsonSchema = zodToJsonSchema(t.schema, { target: 'openApi3' }) as Record<string, unknown>;
        const { $schema, ...inputSchema } = jsonSchema;
        return {
          name: t.name,
          description: t.description,
          inputSchema: inputSchema as { type: 'object'; properties?: Record<string, unknown> },
        };
      }),
    };
  });

  // Call Tool handler
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const rawArgs = (args ?? {}) as Record<string, unknown>;

    try {
      const tool = getTool(name);
      if (!tool) {
        throw new SdkMcpError(ErrorCode.MethodNotFound, `Tool desconocida: ${name}`);
      }

      const parsed = tool.schema.parse(rawArgs);
      // userId must be set by the transport layer before calling
      const userId = (rawArgs as any)._userId;
      if (!userId) {
        throw new CustomMcpError('UNAUTHORIZED', 'Usuario no autenticado', 401);
      }

      const result = await tool.handler(parsed, null as any, null as any, userId);

      if (result && typeof result === 'object' && 'isError' in result && result.isError) {
        return { content: result.content, isError: true };
      }

      return { content: result.content };
    } catch (error) {
      if (error instanceof CustomMcpError) {
        return { content: [{ type: 'text', text: JSON.stringify(error) }], isError: true };
      }
      if (error instanceof SdkMcpError) {
        return { content: [{ type: 'text', text: JSON.stringify(error) }], isError: true };
      }
      if (error instanceof z.ZodError) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Datos de entrada inválidos',
              details: error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
            }),
          }],
          isError: true,
        };
      }
      throw error;
    }
  });

  return mcpServer;
}

export async function validateMcpToken(token: string): Promise<string | null> {
  try {
    // Find all tokens and check hash (we need to find by iterating since we don't know clerkId from token)
    const { db } = await import('../db/mongo');
    const tokens = await db.collection('mcp_tokens').find({}).toArray();
    for (const t of tokens) {
      const match = await compare(token, t.tokenHash);
      if (match) {
        await updateTokenLastUsed(t.clerkId);
        return t.clerkId;
      }
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Create tool handlers (refactored to use DB directly)**

Read the corresponding `mcp-server/src/tools/*.ts` file for each tool, then create the refactored version in `backend/src/mcp/tools/`. The key change: replace `apiClient.get/post()` calls with direct MongoDB queries using `import { db } from '../../../db/mongo'`.

**Pattern for each tool handler:**

```typescript
// backend/src/mcp/tools/list-my-rides.ts
import { z } from 'zod';
import { db } from '../../db/mongo';
import { listMyRidesSchema } from '../schemas';
import { McpError } from '../errors';

export async function handleListMyRides(
  input: z.infer<typeof listMyRidesSchema>,
  _authToken: string | undefined,
  _apiClient: any,
  userId: string
): Promise<{ content: { type: 'text'; text: string }[] }> {
  try {
    const { status, page = 1, limit = 10 } = input;
    const filter: Record<string, any> = { clientId: userId };
    if (status) filter.status = status;

    const [rides, total] = await Promise.all([
      db.collection('rides')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('rides').countDocuments(filter),
    ]);

    const mapped = rides.map((r) => ({
      id: r._id?.toString() ?? r.id,
      title: r.title,
      type: r.type,
      status: r.status,
      estimatedPrice: r.estimatedPrice,
      finalPrice: r.finalPrice,
      pickupAddress: r.pickupLocation?.address ?? '',
      dropoffAddress: r.dropoffLocation?.address ?? '',
      createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
    }));

    return {
      content: [{ type: 'text', text: JSON.stringify({ rides: mapped, total, page, limit }) }],
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError('BACKEND_ERROR', 'Error al listar acarreos: ' + (error as Error).message);
  }
}
```

For each tool handler, the refactoring applies:

| Tool | DB Collection | Filter Key |
|------|--------------|------------|
| `list-my-rides.ts` | `rides` | `{ clientId: userId }` |
| `create-ride.ts` | `rides` | Insert with `clientId: userId` |
| `get-ride-details.ts` | `rides` | `{ _id: ObjectId(rideId), clientId: userId }` |
| `view-offers.ts` | `rides` / `driver_contacts` | `{ rideId }` |
| `accept-offer.ts` | `rides` / `driver_contacts` | Update with `{ _id: ObjectId(rideId), clientId: userId, status: 'requested' }` |
| `list-available-rides.ts` | `rides` | `{ status: 'requested' }` + geo query |
| `get-available-ride-details.ts` | `rides` | `{ _id: ObjectId(rideId) }` |
| `send-offer.ts` | `driver_contacts` | Upsert with `{ rideId, driverId: userId }` |
| `update-ride-status.ts` | `rides` | `{ _id: ObjectId(rideId), driverId: userId }` |
| `get-ride-history.ts` | `rides` | `{ status: { $in: ['completed', 'paid'] }, $or: [{ clientId: userId }, { driverId: userId }] }` |

**IMPORTANT**: For `create-ride.ts`, import `ObjectId` from MongoDB:
```typescript
import { ObjectId } from 'mongodb';  // or use db.ObjectId
```

For geo queries in `list-available-rides.ts`, MongoDB uses `$near` or `$geoWithin`:
```typescript
db.collection('rides').find({
  status: 'requested',
  'pickupLocation.coordinates': {
    $near: {
      $geometry: { type: 'Point', coordinates: [lng, lat] },
      $maxDistance: radiusKm * 1000,
    },
  },
});
```

- [ ] **Step 4: Run typecheck**

```bash
cd backend && bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/mcp/
git commit -m "feat: migrate MCP server and tools into backend"
```

---

### Task 3: Backend MCP HTTP/SSE Route

**Context:** This creates the HTTP route that serves MCP over SSE. Must be done AFTER Task 2 (needs `createMcpServer()` and `validateMcpToken()`). Creates the Hono route that handles `GET /api/mcp` (SSE connection) and `POST /api/mcp/messages`.

**Files:**
- Create: `backend/src/routes/mcp.ts`
- Modify: `backend/src/index.ts` (register route)

- [ ] **Step 1: Create MCP HTTP route**

Read `backend/src/index.ts` first for route registration pattern, then create `backend/src/routes/mcp.ts`:

```typescript
import { Hono } from 'hono/tiny';
import { createMcpServer, validateMcpToken } from '../mcp/server';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const mcpApp = new Hono();

// Store active transports by session
const transports = new Map<string, SSEServerTransport>();

// GET /api/mcp - SSE connection with MCP_API_KEY header
mcpApp.get('/', async (c) => {
  const apiKey = c.req.header('MCP_API_KEY') || c.req.query('token');
  
  if (!apiKey) {
    return c.json({ error: 'MCP_API_KEY header or token query param required' }, 401);
  }

  const clerkId = await validateMcpToken(apiKey);
  if (!clerkId) {
    return c.json({ error: 'Invalid MCP token' }, 403);
  }

  try {
    const mcpServer = createMcpServer();
    
    // Create SSE transport
    const transport = new SSEServerTransport('/api/mcp/messages', c.res);
    
    // Store clerkId on transport for tool calls
    (transport as any)._userId = clerkId;
    
    await mcpServer.connect(transport);
    
    // Store transport for cleanup
    transports.set(transport.sessionId, transport);
    
    // Clean up on close
    c.req.raw.signal?.addEventListener('abort', () => {
      transports.delete(transport.sessionId);
    });

    return; // SSE response handled by transport
  } catch (error) {
    console.error('MCP SSE connection error:', error);
    return c.json({ error: 'Failed to establish MCP connection' }, 500);
  }
});

// POST /api/mcp/messages - Handle MCP messages over SSE
mcpApp.post('/messages', async (c) => {
  const sessionId = c.req.query('sessionId');
  if (!sessionId) {
    return c.json({ error: 'sessionId query param required' }, 400);
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    return c.json({ error: 'Session not found' }, 404);
  }

  try {
    await transport.handlePostMessage(c.req.raw, c.req.raw.headers);
    return c.json({});
  } catch (error) {
    console.error('MCP message error:', error);
    return c.json({ error: 'Failed to handle MCP message' }, 500);
  }
});

export default mcpApp;
```

**NOTE**: The SSE transport approach above is conceptual. The `SSEServerTransport` from MCP SDK may need a different initialization pattern with Hono. The actual implementation may need to:
1. Create a proper streaming Response for SSE
2. Pass it to the transport
3. Return the Response object

The implementation should verify the exact API of `SSEServerTransport` from the SDK.

- [ ] **Step 2: Register MCP route in index.ts**

Modify `backend/src/index.ts`:
```typescript
// Add import at top
import mcp from './routes/mcp';

// Add route after existing routes
app.route('/api/mcp', mcp);
```

- [ ] **Step 3: Run typecheck**

```bash
cd backend && bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/mcp.ts backend/src/index.ts
git commit -m "feat: add MCP HTTP/SSE route"
```

---

### Task 4: Frontend Settings Page

**Context:** Create the `/settings/mcp` page with tabs for OpenCode and Claude Desktop configuration. Independent of backend tasks — uses hardcoded config snippets.

**References:**
- `frontend/src/App.tsx` — route registration pattern
- `frontend/src/pages/*.tsx` — page component patterns

**Files:**
- Create: `frontend/src/pages/SettingsMcp.tsx`
- Modify: `frontend/src/App.tsx` (add route)

- [ ] **Step 1: Create MCP Settings page**

Read `frontend/src/pages/*.tsx` for UI patterns first, then create `frontend/src/pages/SettingsMcp.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { API_URL } from '../services/api';

type Tab = 'opencode' | 'claude';
type EnvTab = 'localhost' | 'production';

export default function SettingsMcp() {
  const { user, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>('opencode');
  const [activeEnv, setActiveEnv] = useState<EnvTab>('localhost');
  const [token, setToken] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      fetchTokenStatus();
    }
  }, [isLoaded, user]);

  async function fetchTokenStatus() {
    try {
      const resp = await fetch(`${API_URL}/api/auth/mcp-token/status`, {
        headers: { Authorization: `Bearer ${await user?.getToken()}` },
      });
      const data = await resp.json();
      if (data.data) {
        setHasToken(data.data.hasToken);
        setCreatedAt(data.data.createdAt);
        setLastUsedAt(data.data.lastUsedAt);
      }
    } catch {}
  }

  async function generateToken() {
    if (!confirm('Generar un nuevo token invalidará el token actual. ¿Continuar?')) return;
    
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/auth/mcp-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await user?.getToken()}` },
      });
      const data = await resp.json();
      if (data.data?.token) {
        setToken(data.data.token);
        setShowToken(true);
        setHasToken(true);
        setCreatedAt(new Date().toISOString());
        setLastUsedAt(null);
      }
    } catch (err) {
      alert('Error al generar token');
    } finally {
      setLoading(false);
    }
  }

  async function revokeToken() {
    if (!confirm('¿Revocar el token actual? Los agentes conectados dejarán de funcionar.')) return;
    
    try {
      await fetch(`${API_URL}/api/auth/mcp-token`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await user?.getToken()}` },
      });
      setHasToken(false);
      setToken(null);
      setShowToken(false);
      setCreatedAt(null);
      setLastUsedAt(null);
    } catch {
      alert('Error al revocar token');
    }
  }

  const baseUrl = activeEnv === 'localhost' ? 'http://localhost:3000' : 'https://api.carglyn.com';

  const openCodeSnippet = `{
  "mcp": {
    "carglyn": {
      "enabled": true,
      "type": "remote",
      "url": "${baseUrl}/api/mcp",
      "env": {
        "MCP_API_KEY": "${showToken && token ? token : 'TU_TOKEN_AQUI'}"
      }
    }
  }
}`;

  const claudeDesktopSnippet = activeEnv === 'localhost'
    ? `{
  "mcpServers": {
    "carglyn": {
      "command": "bun",
      "args": ["run", "../mcp-server/src/index.ts"],
      "env": {
        "MCP_API_KEY": "${showToken && token ? token : 'TU_TOKEN_AQUI'}",
        "BACKEND_URL": "http://localhost:3000"
      }
    }
  }
}`
    : `{
  "mcpServers": {
    "carglyn": {
      "url": "${baseUrl}/api/mcp",
      "headers": {
        "MCP_API_KEY": "${showToken && token ? token : 'TU_TOKEN_AQUI'}"
      }
    }
  }
}`;

  if (!isLoaded) return <div className="loading">Cargando...</div>;

  return (
    <div className="settings-mcp">
      <div className="settings-header">
        <a href="/" className="back-link">
          <span className="material-symbols-rounded">arrow_back</span>
          Volver al inicio
        </a>
        <h1>
          <span className="material-symbols-rounded">api</span>
          Conexión MCP
        </h1>
        <p>Conecta agentes de IA como OpenCode y Claude Desktop a tu cuenta de Carglyn.</p>
      </div>

      {/* Token Section */}
      <div className="mcp-section">
        <h2>Token de Acceso</h2>
        {hasToken ? (
          <div className="token-status">
            <p className="token-active">
              <span className="material-symbols-rounded">check_circle</span>
              Tienes un token activo
              {createdAt && ` (generado el ${new Date(createdAt).toLocaleDateString()})`}
              {lastUsedAt && ` — último uso: ${new Date(lastUsedAt).toLocaleDateString()}`}
            </p>
            {showToken && token && (
              <div className="token-display">
                <code className="token-value">{token}</code>
                <button onClick={() => navigator.clipboard.writeText(token)}>
                  <span className="material-symbols-rounded">content_copy</span>
                  Copiar
                </button>
              </div>
            )}
            <div className="token-actions">
              <button className="btn" onClick={generateToken} disabled={loading}>
                <span className="material-symbols-rounded">refresh</span>
                Generar Nuevo Token
              </button>
              <button className="btn btn-outline" onClick={revokeToken}>
                <span className="material-symbols-rounded">delete</span>
                Revocar Token
              </button>
            </div>
          </div>
        ) : (
          <div className="token-empty">
            <p>No tienes un token de acceso MCP.</p>
            <button className="btn" onClick={generateToken} disabled={loading}>
              <span className="material-symbols-rounded">add</span>
              Generar Token
            </button>
          </div>
        )}
      </div>

      {/* Config Section */}
      <div className="mcp-section">
        <h2>Configuración</h2>
        
        {/* Tabs: OpenCode | Claude */}
        <div className="mcp-tabs">
          <button className={`tab ${activeTab === 'opencode' ? 'active' : ''}`}
            onClick={() => setActiveTab('opencode')}>
            OpenCode
          </button>
          <button className={`tab ${activeTab === 'claude' ? 'active' : ''}`}
            onClick={() => setActiveTab('claude')}>
            Claude Desktop
          </button>
        </div>

        {/* Sub-tabs: Localhost | Production */}
        <div className="mcp-subtabs">
          <button className={`subtab ${activeEnv === 'localhost' ? 'active' : ''}`}
            onClick={() => setActiveEnv('localhost')}>
            Localhost
          </button>
          <button className={`subtab ${activeEnv === 'production' ? 'active' : ''}`}
            onClick={() => setActiveEnv('production')}>
            Producción
          </button>
        </div>

        {/* Config Snippet */}
        <div className="mcp-snippet">
          <pre><code>{activeTab === 'opencode' ? openCodeSnippet : claudeDesktopSnippet}</code></pre>
          <button className="btn btn-sm" onClick={() => {
            const text = activeTab === 'opencode' ? openCodeSnippet : claudeDesktopSnippet;
            navigator.clipboard.writeText(text);
          }}>
            <span className="material-symbols-rounded">content_copy</span>
            Copiar
          </button>
        </div>

        <div className="mcp-instructions">
          {activeTab === 'opencode' ? (
            <div>
              <p><strong>OpenCode:</strong> Pega este snippet en tu archivo <code>~/.config/opencode/opencode.json</code> dentro de la sección <code>mcp</code>.</p>
              {activeEnv === 'localhost' && (
                <p className="hint">💡 Asegúrate de tener el backend corriendo con <code>bun run dev</code> en <code>backend/</code>.</p>
              )}
            </div>
          ) : (
            <div>
              <p><strong>Claude Desktop:</strong> Pega este snippet en tu archivo de configuración de Claude Desktop.</p>
              {activeEnv === 'localhost' && (
                <p className="hint">💡 Asegúrate de tener el backend corriendo con <code>bun run dev</code> en <code>backend/</code>.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route in App.tsx**

Read `frontend/src/App.tsx` first, then add the route:

```tsx
// Add import
import SettingsMcp from './pages/SettingsMcp';

// Add route inside the Routes block
<Route path="/settings/mcp" element={<SettingsMcp />} />
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && bun run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/SettingsMcp.tsx frontend/src/App.tsx
git commit -m "feat: add MCP settings page with token management"
```

---

## Execution Order

```
Phase 1 (PARALLEL):
  Task 1: Token Model + Auth Endpoint
  Task 2: MCP Server Setup + Tools Migration
  Task 4: Frontend Settings Page

Phase 2 (after Task 2):
  Task 3: Backend MCP HTTP/SSE Route
```

Phase 2 can start as soon as Task 2 is complete since it needs `createMcpServer()`.
