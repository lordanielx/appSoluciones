# syntax=docker/dockerfile:1.7
# API NestJS. La imagen final usa la imagen oficial de Playwright porque el informe PDF
# se genera con Chromium en el servidor (ADR-006).
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @meca/api... --filter @meca/shared...
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @meca/shared build && pnpm --filter @meca/api build

FROM mcr.microsoft.com/playwright:v1.56.1-noble AS runtime
ENV NODE_ENV=production PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/api
USER pwuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://localhost:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Aplica migraciones pendientes (nunca synchronize) y arranca.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
