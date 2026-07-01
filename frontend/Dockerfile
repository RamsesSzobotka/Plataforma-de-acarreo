# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Dev target (hot-reload con volúmenes) ──
FROM base AS dev
# El source se monta como volumen externo
EXPOSE 5173
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]

# ── Production build ──
FROM base AS build
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_API_URL
COPY . .
RUN bun run build

# ── Production target (Nginx) ──
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
