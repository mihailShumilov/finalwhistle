# Settlement keeper (Worker + Cron) — run via wrangler dev for the local fallback stack.
FROM node:24-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json biome.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/keeper/package.json ./apps/keeper/
RUN pnpm install --filter "@finalwhistle/keeper..." --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/sdk ./packages/sdk
COPY apps/keeper ./apps/keeper
COPY idl ./idl
RUN pnpm --filter @finalwhistle/shared build && pnpm --filter @finalwhistle/sdk build

EXPOSE 7792
CMD ["pnpm", "--filter", "@finalwhistle/keeper", "exec", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "7792", "--test-scheduled"]
