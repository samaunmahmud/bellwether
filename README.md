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

### Where it fits

Free UK forecasts from bodies like SCOPS and NADIS already exist. Bellwether does not replace them, or a vet. Its value is having everything in one place: risks per livestock group and per field, with the farm's records attached.

## Status

| Phase                                                | State                                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 0 Scaffold (monorepo, lint, format, CI)              | Done                                                                                                |
| 1 Risk engine (TDD, 4 modules)                       | Done                                                                                                |
| 2 GraphQL API (clients, cache, errors)               | Done. Farms, fields and livestock groups are stored in Postgres; the old pet log is still in memory |
| 3 Frontend (home, pet/farm forecasts, animals & log) | Done                                                                                                |
| 4 CI/CD                                              | Workflow written; passes once pushed to GitHub                                                      |
| 5 Azure deploy + README polish                       | To do                                                                                               |

## Architecture

```
React (Vite, Apollo Client)
        │  GraphQL
        ▼
Node API (GraphQL Yoga) ── Redis cache (falls back to direct calls if Redis is down)
        │
        ├── postcodes.io  → postcode → lat/long
        ├── Open-Meteo    → 14-day daily forecast
        └── @bellwether/risk-engine (pure TypeScript, no I/O)
                 tick · dog heatstroke · cattle heat stress · sheep blowfly
```

The risk engine is **pluggable**: every risk implements one `RiskModule` interface (weather in → level, score and reason out). Adding a new risk means one new file, one line in `registry.ts`, and its tests. Nothing else changes.

## Farm data model

```
Farm (name, postcode)
 ├── Field (name, postcode and/or map pin)
 ├── LivestockGroup (species, class, head count, housed?, current field,
 │                   shearing / lambing dates for sheep, dairy-or-beef / calving dates for cattle)
 └── GroupMovement (group, from field → to field, date)   one row per move, so history is kept
```

Every record carries a `farmId`. Farms belong to users through a membership table, so only a farm's members can see or change its data.

A group's forecast uses the most precise location available: its field's **map pin**, then the field's **postcode**, then the **farm postcode**.

## Accounts and privacy

- Sign up with an email and password. Passwords are hashed with scrypt and a random salt per user; they are never stored or logged.
- The session is a random token in an **httpOnly, SameSite=Lax** cookie (Secure in production). The database stores only a hash of the token, and logging out deletes the session.
- Every query and mutation that touches user data checks that you belong to the farm (or own the pet). Someone else's records simply come back as "not found". A test runs every operation in the schema against another user's data, and fails if a new operation is added without being covered.
- The postcode forecast stays public, because it reads no user data.

Choices like these are listed, with the reason for each, in [docs/decisions.md](docs/decisions.md).

## How the risk engine works (and its limits)

All scoring is **deterministic and rule-based**. There is no machine learning and no training, so every result can be explained. The thresholds are **starting heuristics**, kept as named constants at the top of each module. They are marked `TODO(verify source)` until checked against UK veterinary and farming guidance.

| Module             | Who                                       | Rule summary                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tick               | Dogs, cats                                | Mean < 5°C → Low · max ≥ 28°C and humidity < 60% → Low · mean ≥ 7°C and humidity ≥ 80% → High · else Medium · long grass/woodland raises one step                                                                                        |
| Dog heatstroke     | Dogs                                      | Max < 20°C → Low · 20–25°C → Medium · > 25°C → High                                                                                                                                                                                      |
| Cattle heat stress | Cattle                                    | THI = (1.8T + 32) − (0.55 − 0.0055RH)(1.8T − 26). With hourly data: peak hourly THI and hours ≥ 72; otherwise daily max temp and mean humidity · < 68 Low · 68–72 Medium · ≥ 72 High · housed groups get a note                          |
| Sheep blowfly      | Sheep                                     | Mean < 9°C → Low · mean ≥ 15°C and humidity ≥ 70% → High · else Medium · ≥ 2mm rain the previous day raises one step · not shorn, or shorn more than 42 days before the day, raises one step                                             |
| Newborn lamb chill | Sheep whose lambing overlaps the forecast | Chill index C = (11.7 + 3.1√v)(40 − T) + 481 + 418(1 − e^(−0.04R)) kJ/m²/h from mean temp, wind and rain · < 1000 Low · 1000–1100 Medium · ≥ 1100 High · lambing dates + 3 days only                                                     |
| Liver fluke season | Sheep, cattle                             | Ollerenshaw index: each May–Oct month Mt = n(R − P + 5) (rain days, rain and evapotranspiration in inches), capped at 100 (50 in May and Oct), summed · < 300 Low · 300–400 Medium · > 400 High · one value per season, refreshed weekly |

Each livestock group only gets the modules for its species, and lamb chill and fluke only when they apply (during lambing; when a season's past weather is available). Past weather comes from the Open-Meteo archive, which runs about five days behind.

Known limitations:

- Without hourly data, daily averages hide hourly peaks. Heat stress uses hourly data; the other modules use daily values.
- Forecast accuracy falls off after about a week.
- Rules don't account for local habitat, breed or age. Housing is only noted, not modelled: shed conditions can differ a lot from outdoor weather.
- The chill index was developed with wind measured near the ground; Bellwether uses 10 m wind, which will tend to overstate chill.
- The Ollerenshaw index is a season-level indicator. A 2023 evaluation (Howell et al., Veterinary Record) found it not sensitive enough to rely on as a standalone early warning, so treat it as one signal among several.
- Flea risk is deliberately not modelled: central heating keeps fleas active indoors all year, so weather is a poor predictor.

### Thresholds to verify

Every number below is a named constant in `packages/risk-engine/src/risks/` marked `heuristic TODO(verify source)`. None should be treated as validated until checked against UK veterinary and farming guidance.

| Module             | Constant                                            | Value                         | Notes                                                                                        |
| ------------------ | --------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| Tick               | `TICK_COLD_MEAN_C`                                  | 5 °C                          | Below this mean, Low                                                                         |
| Tick               | `TICK_ACTIVE_MEAN_C` / `TICK_HUMID_PCT`             | 7 °C / 80 %                   | At or above both, High                                                                       |
| Tick               | `TICK_HOT_MAX_C` / `TICK_DRY_PCT`                   | 28 °C / 60 %                  | Hot and dry, Low                                                                             |
| Dog heatstroke     | `HEATSTROKE_MEDIUM_MAX_C` / `HEATSTROKE_HIGH_MAX_C` | 20 °C / 25 °C                 | Daily max                                                                                    |
| Cattle heat stress | `THI_MEDIUM` / `THI_HIGH`                           | 68 / 72                       | Dairy cattle are often given lower bands                                                     |
| Sheep blowfly      | `BLOWFLY_COLD_MEAN_C`                               | 9 °C                          | Below this mean, Low                                                                         |
| Sheep blowfly      | `BLOWFLY_WARM_MEAN_C` / `BLOWFLY_HUMID_PCT`         | 15 °C / 70 %                  | At or above both, High                                                                       |
| Sheep blowfly      | `BLOWFLY_RAIN_MM`                                   | 2 mm                          | Previous day's rain raises one step                                                          |
| Sheep blowfly      | `BLOWFLY_FLEECE_DAYS`                               | 42 days                       | Fleece regrowth after shearing (~6 weeks)                                                    |
| Lamb chill         | Formula coefficients                                | 11.7, 3.1, 40, 481, 418, 0.04 | Formula form from secondary sources (Nixon-Smith 1972; Donnelly 1984); originals not checked |
| Lamb chill         | `CHILL_MEDIUM` / `CHILL_HIGH`                       | 1000 / 1100 kJ/m²/h           | Band edges                                                                                   |
| Lamb chill         | `NEWBORN_DAYS`                                      | 3 days                        | How long after the last lambing date lambs count as newborn                                  |
| Liver fluke        | Formula `n(R − P + 5)` in inches                    | —                             | Read from secondary sources, not the 1959 paper (Ollerenshaw & Rowlands)                     |
| Liver fluke        | `FLUKE_RAIN_DAY_MM`                                 | 0.2 mm                        | Rain-day threshold (Met Éireann's; others use 1 mm)                                          |
| Liver fluke        | `FLUKE_MONTH_CAP` / `FLUKE_SHOULDER_MONTH_CAP`      | 100 / 50                      | Monthly cap; May and October halved                                                          |
| Liver fluke        | `FLUKE_MEDIUM` / `FLUKE_HIGH`                       | 300 / 400                     | Season-total bands                                                                           |

## Running locally

Requirements: Node 20+, and optionally Docker for Redis/Postgres.

```bash
npm install                   # also generates the Prisma client
cp .env.example .env          # optional; without it, Redis and Postgres fall back to in-memory stores
docker compose up -d          # Postgres (dev + test databases) and Redis
npm run db:migrate            # apply database migrations
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
| `npm run db:migrate`                    | Create/apply Prisma migrations (dev DB)     |
| `npm run db:test:prepare`               | Apply migrations to the test DB             |

## Testing approach

- **Risk engine:** boundary tests (just below, on, and just above every threshold), hand-worked THI values, and a contract test that runs every module over a grid of weather and checks every result has a valid level, score and reason.
- **Repositories:** one shared contract suite runs against the in-memory fake and against real Postgres (when `TEST_DATABASE_URL` is set: run `npm run db:test:prepare` first). CI runs both, using a Postgres service container.
- **Access control:** a second user tries every query and mutation against the first user's farm, field, group, pet and log, and the first user's data is checked before and after (FR-8.4).
- **API:** external clients tested with mocked `fetch`. The GraphQL layer is tested end-to-end through Yoga with fake clients, including invalid postcodes, unknown postcodes, weather API down, postcode API down, and Redis down. No test ever calls a real external API.
- **Frontend:** React Testing Library tests for risk cards, the chart, the log form, the disclaimer, the forecast page's loading and error states, log in / sign up, the signed-in route guard, and the farm, field, group and move forms.

## Project layout

```
packages/risk-engine   pure TS rules + tests
apps/api               GraphQL API, clients, cache, repository + tests
apps/web               React frontend + tests
```

## Data sources

- Postcode lookup: [postcodes.io](https://postcodes.io) (free, no key)
- Weather: [Open-Meteo](https://open-meteo.com) forecast API (free, no key)
