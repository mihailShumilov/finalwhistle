# Next.js 16 frontend — multi-stage build, non-root runtime.
FROM node:24-bookworm-slim AS builder
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json biome.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --filter "@finalwhistle/web..." --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/sdk ./packages/sdk
COPY apps/web ./apps/web
COPY idl ./idl
RUN pnpm --filter @finalwhistle/shared build \
  && pnpm --filter @finalwhistle/sdk build \
  && pnpm --filter @finalwhistle/web build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN useradd -m -u 10001 nextjs
COPY --from=builder --chown=nextjs:nextjs /app /app
USER nextjs
EXPOSE 7790
CMD ["node_modules/.bin/next", "start", "apps/web", "-p", "7790"]
