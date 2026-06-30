# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Dev target (hot-reload con volúmenes) ──
FROM base AS dev
# El source se monta como volumen en docker-compose
EXPOSE 3000
CMD ["bun", "--watch", "src/index.ts"]

# ── Production build ──
FROM base AS build
COPY . .
RUN bun build src/index.ts --outdir ./dist --target bun

# ── Production target ──
FROM oven/bun:1 AS prod
COPY --from=build /app/dist /app/dist
COPY --from=build /app/node_modules /app/node_modules
EXPOSE 3000
CMD ["bun", "run", "/app/dist/index.js"]
