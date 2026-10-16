# Bellwether API. Build from the repo root:  docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install dependencies first so this layer is cached between code changes.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/risk-engine/package.json packages/risk-engine/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# The API's postinstall generates the Prisma client, so its schema and config come first.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN npm ci --workspace=@bellwether/api --workspace=@bellwether/risk-engine

COPY packages/risk-engine packages/risk-engine
COPY apps/api apps/api
RUN npm run build --workspace=@bellwether/api

FROM node:22-bookworm-slim
ENV NODE_ENV=production
# Prisma's migration engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Production dependencies only (prisma is a runtime dependency: it applies migrations on start).
COPY package.json package-lock.json ./
COPY packages/risk-engine/package.json packages/risk-engine/
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --omit=dev --workspace=@bellwether/api && npm cache clean --force
COPY --from=build /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply any pending database migrations, then start the API (and its briefing job).
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
