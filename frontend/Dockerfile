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
COPY . .
RUN bun run build

# ── Production target (Nginx) ──
FROM nginx:alpine AS prod
# envsubst para reemplazar ${BACKEND_URL} en nginx.conf
RUN apk add --no-cache gettext
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
