# Render Deployment

Guía mínima para desplegar la plataforma en Render Free + MongoDB Atlas sin guardar secretos en el repo.

## Servicios Render

Podés usar el blueprint `render.yaml` desde el dashboard de Render o crear los servicios manualmente.

### Backend Web Service

- **Root directory:** `backend`
- **Runtime:** Node (Render ejecuta Bun desde los comandos)
- **Plan:** Free
- **Build command:** `bun install`
- **Start command:** `bun run start`
- **Health check path:** `/health`

Variables requeridas en Render (no las pongas en el repo):

- `DATABASE_URL` - connection string de MongoDB Atlas
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `FRONTEND_URL` - URL pública del static site, por ejemplo `https://tu-frontend.onrender.com`
- `ALLOWED_ORIGINS` - orígenes separados por coma, por ejemplo `https://tu-frontend.onrender.com,http://localhost:5173`
- `REDIS_URL` - opcional; el tracking tiene fallback si Redis no está disponible

En desarrollo local, el backend permite por defecto `http://localhost:5173`, `http://localhost:5174` y `http://localhost:3000`. En producción (`NODE_ENV=production`), configurá `FRONTEND_URL` y/o `ALLOWED_ORIGINS` explícitamente.

### Frontend Static Site

- **Root directory:** `frontend`
- **Build command:** `bun install && bun run build`
- **Publish directory:** `dist`
- **Rewrite:** `/*` → `/index.html` para React Router

Variables de build del frontend:

- `VITE_API_URL` - URL pública del backend, por ejemplo `https://tu-backend.onrender.com`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_CLOUDINARY_CLOUD_NAME`

## MongoDB Atlas para Render Free

Render Free no ofrece IP fija. Para pruebas, en Atlas agregá temporalmente Network Access `0.0.0.0/0`.

**Riesgo:** esto permite conexiones desde cualquier IP si tienen credenciales válidas. Usalo solo durante la validación inicial, con usuario de permisos mínimos y contraseña fuerte. Para producción real, migrá a un plan/arquitectura con IP fija o controles de red más estrictos.

## Checklist post-deploy

1. Crear el cluster en MongoDB Atlas y copiar el connection string a `DATABASE_URL`.
2. Configurar todas las variables en Render antes del primer deploy.
3. Desplegar backend y verificar `GET https://tu-backend.onrender.com/health` → `{ "ok": true }`.
4. Copiar la URL del backend a `VITE_API_URL` en el frontend y redesplegar el static site.
5. Copiar la URL del frontend a `FRONTEND_URL` y `ALLOWED_ORIGINS` en el backend y redesplegar el backend.
6. Configurar webhooks externos con URLs públicas de Render:
   - Clerk: `https://tu-backend.onrender.com/api/auth/webhook`
   - Stripe: `https://tu-backend.onrender.com/api/payments/webhook`
