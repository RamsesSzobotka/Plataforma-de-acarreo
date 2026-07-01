# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Dev target (hot-reload con volúmenes) ──
FROM base AS dev
COPY . .
EXPOSE 3000
CMD ["bun", "run", "--watch", "src/index.ts"]

# ── Production runtime ──
# Bun ejecuta TypeScript nativamente, no necesita build step.
FROM base AS prod
COPY . .
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
