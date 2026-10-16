# Bellwether

[![CI](https://github.com/samaunmahmud/bellwether/actions/workflows/ci.yml/badge.svg)](https://github.com/samaunmahmud/bellwether/actions/workflows/ci.yml)

Weather-driven animal health risk forecasts for **pet owners** and **farmers**.

Enter a UK postcode and Bellwether turns the next 14 days of weather into day-by-day risk levels, each with a plain-English reason:

| Who               | Risk           | Driven by                                        |
| ----------------- | -------------- | ------------------------------------------------ |
| Pets (dogs, cats) | Tick activity  | Mild, humid weather; long grass / woodland walks |
| Pets (dogs)       | Heatstroke     | Daily maximum temperature                        |
| Farm (cattle)     | Heat stress    | Temperature-Humidity Index (THI)                 |
| Farm (sheep)      | Blowfly strike | Warm, humid weather, especially after rain       |

You can also keep a simple treatment and check log per animal or herd, with "next due" dates and overdue highlighting.

> This is an awareness tool, not veterinary advice.

## Status

| Phase                                                | State                                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 0 Scaffold (monorepo, lint, format, CI)              | Done                                                                                         |
| 1 Risk engine (TDD, 4 modules)                       | Done                                                                                         |
| 2 GraphQL API (clients, cache, errors)               | Done, except Postgres: logs use an in-memory store for now (`prisma/schema.prisma` is ready) |
| 3 Frontend (home, pet/farm forecasts, animals & log) | Done                                                                                         |
| 4 CI/CD                                              | Workflow written; passes once pushed to GitHub                                               |
| 5 Azure deploy + README polish                       | To do                                                                                        |

## Architecture

```
React (Vite, Apollo Client)
        │  GraphQL
        ▼
Node API (GraphQL Yoga) ── Redis cache (falls back to direct calls if Redis is down)
        │
        ├── postcodes.io  → postcode → lat/long
        ├── Open-Meteo    → 14-day daily forecast
        └── @animalcast/risk-engine (pure TypeScript, no I/O)
                 tick · dog heatstroke · cattle heat stress · sheep blowfly
```

The risk engine is **pluggable**: every risk implements one `RiskModule` interface (weather in → level, score and reason out). Adding a new risk means one new file, one line in `registry.ts`, and its tests. Nothing else changes.

## How the risk engine works (and its limits)

All scoring is **deterministic and rule-based**. There is no machine learning and no training, so every result can be explained. The thresholds are **starting heuristics**, kept as named constants at the top of each module. They are marked `TODO(verify source)` until checked against UK veterinary and farming guidance.

| Module             | Rule summary                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tick               | Mean < 5°C → Low · max ≥ 28°C and humidity < 60% → Low · mean ≥ 7°C and humidity ≥ 80% → High · else Medium · long grass/woodland raises one step |
| Dog heatstroke     | Max < 20°C → Low · 20–25°C → Medium · > 25°C → High                                                                                               |
| Cattle heat stress | THI = (1.8T + 32) − (0.55 − 0.0055RH)(1.8T − 26) using daily max temp and mean humidity · < 68 Low · 68–72 Medium · ≥ 72 High                     |
| Sheep blowfly      | Mean < 9°C → Low · mean ≥ 15°C and humidity ≥ 70% → High · else Medium · ≥ 2mm rain the previous day raises one step                              |

Known limitations:

- Daily averages hide hourly peaks.
- Forecast accuracy falls off after about a week.
- Rules don't account for local habitat, animal breed, age or housing.
- Flea risk is deliberately not modelled: central heating keeps fleas active indoors all year, so weather is a poor predictor.

## Running locally

Requirements: Node 20+, and optionally Docker for Redis/Postgres.

```bash
npm install
cp .env.example .env          # optional; works without Redis too (uses an in-memory cache)
docker compose up -d redis    # optional
npm run dev:api               # http://localhost:4000/graphql
npm run dev:web               # http://localhost:5173 (proxies /graphql to the API)
```

## Scripts

| Command                                 | What it does                                |
| --------------------------------------- | ------------------------------------------- |
| `npm test`                              | All tests in every workspace                |
| `npm run test:coverage`                 | Tests with coverage (engine enforces ≥ 95%) |
| `npm run lint` / `npm run format:check` | ESLint / Prettier                           |
| `npm run typecheck`                     | TypeScript strict mode, every workspace     |
| `npm run build`                         | Production builds                           |

## Testing approach

- **Risk engine:** boundary tests (just below, on, and just above every threshold), hand-worked THI values, and a contract test that runs every module over a grid of weather and checks every result has a valid level, score and reason.
- **API:** external clients tested with mocked `fetch`. The GraphQL layer is tested end-to-end through Yoga with fake clients, including invalid postcodes, unknown postcodes, weather API down, postcode API down, and Redis down. No test ever calls a real external API.
- **Frontend:** React Testing Library tests for risk cards, the chart, the log form, the disclaimer, and the forecast page's loading and error states.

## Project layout

```
packages/risk-engine   pure TS rules + tests
apps/api               GraphQL API, clients, cache, repository + tests
apps/web               React frontend + tests
```

## Data sources

- Postcode lookup: [postcodes.io](https://postcodes.io) (free, no key)
- Weather: [Open-Meteo](https://open-meteo.com) forecast API (free, no key)
