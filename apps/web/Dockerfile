# Bellwether web app, served by nginx. Build from the repo root:  docker build -f apps/web/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/risk-engine/package.json packages/risk-engine/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=@bellwether/web --include-workspace-root

COPY apps/web apps/web
RUN npm run build --workspace=@bellwether/web

FROM nginx:1.28-alpine
# nginx fills in ${API_URL} when the container starts.
ENV API_URL=http://api:4000
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
