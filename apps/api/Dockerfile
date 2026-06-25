# Read API (Hono on Workers) — run via wrangler dev in a container for the local fallback stack.
FROM node:24-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

# Workspace manifests first (better layer caching).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json biome.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --filter "@finalwhistle/api..." --frozen-lockfile

# Sources.
COPY packages/shared ./packages/shared
COPY packages/sdk ./packages/sdk
COPY apps/api ./apps/api
COPY idl ./idl
RUN pnpm --filter @finalwhistle/shared build && pnpm --filter @finalwhistle/sdk build

EXPOSE 7791
# `wrangler dev` runs the Worker locally (workerd); --ip 0.0.0.0 exposes it from the container.
CMD ["pnpm", "--filter", "@finalwhistle/api", "exec", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "7791"]
