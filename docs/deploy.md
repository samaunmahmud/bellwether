# Deploying Bellwether

Bellwether runs as two containers plus Postgres:

| Container | Image built from      | Listens on | Notes                                                                                                                    |
| --------- | --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| `web`     | `apps/web/Dockerfile` | 8080       | nginx serving the React app and forwarding `/graphql` to the API (same origin, so the session cookie works without CORS) |
| `api`     | `apps/api/Dockerfile` | 4000       | GraphQL API and the daily briefing job. Applies database migrations on start. Health check: `GET /health`                |

Redis is optional (the API falls back to an in-memory cache). Email needs any SMTP server.

## Try the production build locally

```bash
docker compose -f docker-compose.prod.yml up --build
# App: http://localhost:8088    Emails: http://localhost:8188
```

## Environment variables (API)

| Variable               | Required  | Example                                                       | Purpose                                             |
| ---------------------- | --------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`         | yes       | `postgresql://user:pass@host:5432/bellwether?sslmode=require` | Postgres                                            |
| `NODE_ENV`             | yes       | `production`                                                  | Turns on `Secure` session cookies                   |
| `APP_URL`              | yes       | `https://bellwether.example.com`                              | Links in emails                                     |
| `SMTP_URL`             | for email | `smtps://user:pass@smtp.example.com:465`                      | Daily briefing email. Unset: emails are only logged |
| `EMAIL_FROM`           | for email | `Bellwether <briefing@example.com>`                           | Sender                                              |
| `REDIS_URL`            | no        | `rediss://:pass@host:6380`                                    | Cache for postcodes and weather                     |
| `BRIEFING_JOB_MINUTES` | no        | `5`                                                           | How often the briefing job runs; `0` turns it off   |
| `LOG_LEVEL`            | no        | `info`                                                        | `debug` shows cache hits and misses                 |

The web container needs only `API_URL`, the API's internal address (e.g. `http://bellwether-api`).

Keep secrets (database password, SMTP password) in the platform's secret store, never in the image or repo.

## Azure Container Apps (planned target)

These steps need an Azure subscription and the Azure CLI (`az login`). Check current Azure pricing before creating resources; the smallest tiers are enough for a demo. Names below are examples.

```bash
RG=bellwether-rg; LOC=uksouth; ACR=bellwetheracr$RANDOM; ENV=bellwether-env

az group create -n $RG -l $LOC
az acr create -g $RG -n $ACR --sku Basic --admin-enabled true

# Build both images in Azure from the repo root
az acr build -r $ACR -t bellwether-api:1 -f apps/api/Dockerfile .
az acr build -r $ACR -t bellwether-web:1 -f apps/web/Dockerfile .

# Postgres Flexible Server (smallest burstable tier); allow Azure services to connect
az postgres flexible-server create -g $RG -n bellwether-db -l $LOC \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 \
  --admin-user bellwether --admin-password '<strong password>' --public-access 0.0.0.0
az postgres flexible-server db create -g $RG -s bellwether-db -d bellwether

az containerapp env create -g $RG -n $ENV -l $LOC

# API: internal only, one replica (the briefing job runs inside it)
az containerapp create -g $RG -n bellwether-api --environment $ENV \
  --image $ACR.azurecr.io/bellwether-api:1 --registry-server $ACR.azurecr.io \
  --ingress internal --target-port 4000 --min-replicas 1 --max-replicas 1 \
  --secrets db-url='postgresql://bellwether:<password>@bellwether-db.postgres.database.azure.com:5432/bellwether?sslmode=require' smtp-url='<smtp url>' \
  --env-vars DATABASE_URL=secretref:db-url SMTP_URL=secretref:smtp-url NODE_ENV=production \
    APP_URL=https://<web app url> EMAIL_FROM='Bellwether <briefing@example.com>'

# Web: public HTTPS
az containerapp create -g $RG -n bellwether-web --environment $ENV \
  --image $ACR.azurecr.io/bellwether-web:1 --registry-server $ACR.azurecr.io \
  --ingress external --target-port 8080 \
  --env-vars API_URL=http://bellwether-api
```

Then set `APP_URL` on the API to the web app's URL (`az containerapp show -g $RG -n bellwether-web --query properties.configuration.ingress.fqdn`).

Why one API replica: the briefing job is safe to run on several replicas (each email is claimed in the database before sending), but one replica keeps cost down and avoids duplicate briefing generation.

## Cheaper alternatives

Any host that runs two containers and offers Postgres works: for example a small VM with `docker-compose.prod.yml` behind a reverse proxy with HTTPS, or a container platform with a free-tier managed Postgres. Check each provider's current free-tier limits before relying on them.

## Before going live

- Use HTTPS only (Container Apps does this by default). Session cookies are `Secure` in production.
- Login rate limiting, email verification and password reset are not built yet (docs/decisions.md, A16).
- The API image is about 880 MB, mostly the Prisma CLI used to apply migrations on start. Running migrations as a separate job would shrink it.
