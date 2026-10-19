<p align="center">
  <img src="docs/screenshots/hero.webp" alt="Bellwether: a hill farm's dashboard with today's risks and tasks on a laptop, the morning briefing on a phone, and a dog's record card in the dark theme" width="100%" />
</p>

<h1 align="center">Bellwether: know what the weather means for your animals, before it happens</h1>

<p align="center">
  Animal health risk forecasts for UK farms and pet owners.<br>
  Bellwether turns the next 14 days of weather into day-by-day risk of <b>heat stress, blowfly strike, newborn lamb chill, liver fluke, ticks and dog heatstroke</b>, each with a plain-English reason.<br>
  Around the forecast it keeps the records a small farm needs: holding register, medicine book, tasks, documents and the farm's team.
</p>

<p align="center">
  <a href="https://github.com/samaunmahmud/bellwether/actions/workflows/ci.yml"><img src="https://github.com/samaunmahmud/bellwether/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/tests-1%2C134_passing-2d6a4f?style=flat-square" alt="1,134 tests passing" />
  <img src="https://img.shields.io/badge/risk_engine_coverage-100%25-2d6a4f?style=flat-square" alt="Risk engine coverage 100%" />
  <img src="https://img.shields.io/badge/status-working_prototype-b5651d?style=flat-square" alt="Status: working prototype" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript_strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript (strict)" />
  <img src="https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Apollo_Client-311C87?style=flat-square&logo=apollographql&logoColor=white" alt="Apollo Client" />
  <img src="https://img.shields.io/badge/GraphQL_Yoga-E10098?style=flat-square&logo=graphql&logoColor=white" alt="GraphQL Yoga" />
  <img src="https://img.shields.io/badge/Node.js_22-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 22" />
  <img src="https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/Prisma_7-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma 7" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white" alt="PWA" />
</p>

> [!IMPORTANT]
> **An awareness tool, not veterinary advice.** Every risk comes from simple, published-style weather rules, not from examining an animal. The thresholds are starting heuristics, each marked `TODO(verify source)` in the code and [listed below](#thresholds-still-to-verify). Bellwether never names products, drugs or doses, and every forecast page says: _"Speak to your vet."_ All farms, people and records in the screenshots are fictional.

<p align="center"><b><i>Flystrike, heat stress and chilled lambs all follow the weather, and the weather is forecast days ahead.<br>Bellwether exists so a farmer sees the risky days coming, for each group in each field, while there is still time to act.</i></b></p>

---

## The 60-second version

- **What it is:** a web app (installable on a phone) for UK livestock farmers and pet owners. Enter a postcode, or set up your farm, and see the next 14 days as **Low / Medium / High risk per animal group, per day, with the reason in words**.
- **Who it's for:** sheep and cattle farmers, the people who work with them, their vets and advisers, and dog and cat owners.
- **What makes it different:** the risk engine is **deterministic and explainable**. No machine learning, no black box: every level comes from a named rule with a named threshold, and the reason says which weather caused it ("Peak THI 74 around 3pm: heat stress likely"). It is honest about what it doesn't know.
- **What it's built from:** a pure TypeScript risk engine with **100% test coverage**, a GraphQL API on Node with Postgres (Prisma) and Redis, a React front end, and **1,134 automated tests** run by GitHub Actions on every push, including a contract suite against a real Postgres.

## Contents

- [The problem](#the-problem)
- [What Bellwether does](#what-bellwether-does)
- [Who it helps](#who-it-helps)
- [Results in numbers](#results-in-numbers)
- [A tour of the app](#a-tour-of-the-app)
- [How it works](#how-it-works)
- [The risk engine](#the-risk-engine)
- [Security and privacy](#security-and-privacy)
- [How the project was planned](#how-the-project-was-planned)
- [Design decisions](#design-decisions)
- [Getting started](#getting-started)
- [Tests](#tests)
- [Project structure](#project-structure)
- [Limitations](#limitations)
- [What's next](#whats-next)
- [Credits](#credits)

---

## The problem

Many of the costliest problems on a livestock farm are driven by the weather, and the weather is forecast days in advance. Yet the warning rarely reaches the person who needs it, in a form they can act on:

1. **Weather forecasts don't speak animal.** "17°C, 85% humidity, rain yesterday" doesn't say "check the unshorn ewes in Top Fell for flystrike on Thursday". The farmer has to do the translation in their head, for every group, every day.
2. **Risk depends on the group, not just the place.** Ewes shorn last week and ewes not yet shorn face different blowfly risk in the same field. Housed calves and cows at grass face different heat. Generic regional warnings can't see that.
3. **The records live somewhere else.** The forecast is on one website, treatments in a paper medicine book, tasks on a whiteboard, the vet's number in a phone. When a risk turns High there's no single place that says what's been done and what needs doing.
4. **Pet owners get even less.** Tick activity and dog heatstroke follow the weather too, but most owners only find out when the vet tells them.

**Bellwether translates the forecast into risk for each animal group, says why in plain English, and puts the farm's records and tasks next to it.**

## What Bellwether does

1. **You tell it where.** A UK postcode for a quick forecast, or a farm with fields (by postcode or a pin on the map) and livestock groups: species, class, head count, which field, shearing and lambing dates, housed or out.
2. **It fetches the weather.** 14 days of daily and hourly forecast from Open-Meteo, plus the season's past weather from the archive for liver fluke, cached in Redis so repeat visits are instant.
3. **The risk engine scores each day.** Each group only gets the modules that apply to its species and situation: blowfly takes days since shearing into account, lamb chill only runs around lambing, heat stress uses the hourly peak. Each day gets a level, a 0–100 score for charts, and a reason.
4. **It tells you what matters this week.** A morning briefing (on the page and by email, at the time you choose) lists overdue tasks, then every Medium or High risk in the next 7 days, most severe first, with general husbandry checks. One tap turns a check into a task.
5. **You record what you did.** Treatments with withdrawal periods, checks, births, deaths and moves, weights and worm egg counts, documents and photos. Everything is shared with the farm's team, by role.

## Who it helps

|                          |                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🐑 **Sheep farmers**     | Blowfly strike that knows when each flock was shorn, newborn lamb chill around lambing dates, and a season-level liver fluke index, per group and per field.                     |
| 🐄 **Cattle farmers**    | Heat stress from the Temperature-Humidity Index using the **hourly** peak and how many hours sit above the threshold, with a note when a group is housed.                        |
| 👩‍🌾 **The farm team**     | One task board for owners and workers, tasks assigned to people, repeats ("every 7 days"), and the morning email so nobody has to log in to know what's due.                     |
| 🩺 **Vets and advisers** | Invited as **Viewers**: they can read the risks, the medicine book and the register without being able to change them.                                                           |
| 📋 **Inspection day**    | Holding register with running totals, medicine book with batches and withdrawal dates, and CSV and print export of each.                                                         |
| 🐕 **Pet owners**        | Tick and heatstroke forecast at home, a "walks in long grass or woodland" toggle, a health plan with emailed reminders, a weight chart, and a walk planner for the cooler hours. |

## Results in numbers

|                      |                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Risk modules**     | **6 modules**: tick activity, dog heatstroke, cattle heat stress (THI), sheep blowfly strike, newborn lamb chill, liver fluke season      |
| **Tests**            | **1,134 passing**: 154 risk engine, 689 API (including 84 repository contract tests run against real Postgres), 291 frontend              |
| **Coverage**         | risk engine **100%** of statements, branches, functions and lines (CI fails below 95%)                                                    |
| **Forecast**         | **14 days**, daily and hourly, per livestock group, at the most precise location known (map pin, then field postcode, then farm postcode) |
| **Caching**          | postcode lookups kept **30 days**, weather **1 hour**, keyed on rounded coordinates; the app keeps working if Redis is down               |
| **Code**             | about **850 lines** of risk engine, **10,200** of API and **13,300** of React (TypeScript, strict mode); 16 database migrations           |
| **Decisions**        | **103 recorded decisions** with the reason for each, in [docs/decisions.md](docs/decisions.md)                                            |
| **Machine learning** | **None**, by design. Every result can be traced to a rule and a number.                                                                   |

---

## A tour of the app

Every screenshot below is the real application running locally on a one-click demo account. The farms, people, animals and documents are fictional. Click any image to see it at full resolution.

### 1. Signing in, or exploring in one click

The login page shows a live risk from today's real forecast near Kendal. **"Explore a demo account"** builds a private account with two farms, a team and two pets in a few seconds, with no email needed.

![Login page: a misty Lake District gate, the sign-in card, and a live cattle heat stress card for Kendal](docs/screenshots/login.webp)

### 2. No account needed: the postcode forecast

Anyone can type a UK postcode and see 14 days of risk. Pet owners get tick activity and dog heatstroke; every bar has its level in words as well as colour, and every day has its reason.

![Pet forecast for LA9 4DQ: tick activity High on most days because it is mild and humid, dog heatstroke Low](docs/screenshots/pet-forecast.webp)

**"Walks in long grass or woodland"** raises tick risk by one step, and the reason says so:

![The same forecast with the long-grass toggle on: tick risk raised](docs/screenshots/pet-forecast-grass.webp)

Farmers get cattle heat stress (with the THI value in the reason) and sheep blowfly strike:

![Farm forecast: cattle heat stress Low with peak THI 55.9, sheep blowfly strike Medium on mild days](docs/screenshots/farm-forecast.webp)

### 3. The farm dashboard

The first screen for a farm: today's weather, head count on the holding, overdue tasks, groups in withdrawal, losses and births over 12 months, what needs attention (overdue, out-of-date medicines, things due soon), the week's weather and risk, and recent activity.

![Fellside Farm dashboard: 626 animals, 1 overdue task, 2 groups in withdrawal, needs-attention list, week's weather, risk this week and recent activity](docs/screenshots/dashboard.webp)

### 4. The morning briefing

One page, and one email a day, that answers: **which animals, in which fields, need attention this week, and what should I check?** Overdue tasks first, then every Medium or High risk per group with the days affected and the weather behind it. Suggested checks are general husbandry only, and a test fails if any of them mentions a dose. Each check becomes a task with one tap.

![Morning briefing: an overdue foot check, then Mule ewes in Top Fell at High blowfly risk because the flock was shorn 120 days ago, with checks and Add task buttons](docs/screenshots/briefing.webp)

### 5. Weather and risk, for every group

14 days of weather (temperature, rain, humidity, each chart also available as a table) and a **risk heatmap for every group and every module**. Each cell shows a letter, not just a colour; hover or tap any day to see why.

![Weather and risk page: rain and temperature totals, 14 day cards, temperature, rain and humidity charts, and the risk heatmap](docs/screenshots/outlook.webp)

<p align="center">
  <img src="docs/screenshots/heatmap.webp" alt="The risk heatmap with Mule ewes, Monday 19 October selected: High, mild conditions, raised because the flock was shorn 120 days ago" width="820" />
</p>

### 6. Fields, groups and grazing

Fields on an OpenStreetMap map, coloured by whether they are grazed or resting and for how long, so the farmer can plan rotations. Moving a pin or a group is one click.

![Farm map with five pinned fields and the fields-and-grazing list](docs/screenshots/map.webp)

Each livestock group has its head count, field, withdrawal status, shearing, lambing or calving dates, and movement history:

![Livestock page: Mule ewes, Spring lambs, Suckler cows, Tups and Youngstock with head counts, fields and withdrawal badges](docs/screenshots/livestock.webp)

A group's own page charts its worm egg counts and body condition, lists its treatments and checks, and links any individually tagged animals:

![Mule ewes group: worm egg count and body condition charts, tagged animals, treatment and check forms](docs/screenshots/group.webp)

### 7. Tagged animals

Groups stay the unit for head counts and forecasts, but a cow, a ram or a pedigree ewe can be followed on its own: ear tag, name, sex, breed, age and group.

![Tagged animals: cattle and sheep with UK ear tags, breeds, ages and groups](docs/screenshots/tagged.webp)

### 8. Tasks, with a board and a calendar

Tasks for the whole farm or a group, assigned to a team member, repeating if needed. A list or a board, and a progress ring at the top.

|                                                       List                                                       |                                                       Board                                                       |
| :--------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------: |
| <img src="docs/screenshots/tasks.webp" alt="Task list with one overdue foot check and four to do" width="400" /> | <img src="docs/screenshots/tasks-board.webp" alt="Task board with Overdue, To do and Done columns" width="400" /> |

The calendar puts tasks, withdrawal end dates, seasons (lambing, calving), records and medicine expiry in one month view:

![Farm calendar for October 2026 with tasks, records and withdrawal ends](docs/screenshots/calendar.webp)

### 9. Ready for inspection: register, medicines and treatments

The **holding register** keeps births, deaths, moves on and off, and tag replacements with a running head count, plus weights, worm egg counts and condition scores. Download as CSV or print. Mistakes are voided with a reason, never silently deleted.

|                                                                        Register                                                                         |                                                 Weights, egg counts and condition                                                 |
| :-----------------------------------------------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------: |
| <img src="docs/screenshots/register.webp" alt="Holding register with deaths, moves, tags replaced and births, and head count after each" width="400" /> | <img src="docs/screenshots/register-measures.webp" alt="Weighings, worm egg counts and condition scores per group" width="400" /> |

The **medicine cabinet** flags what's out of date or expiring soon. Treatments fill in from the cabinet, and withdrawal periods must come from the product label or the vet (Bellwether never suggests one).

![Medicine cabinet: a fly treatment out of date, a pour-on expiring in 20 days, a wormer in date](docs/screenshots/medicines.webp)

![Treatment records: date, group, product, batch, animals, given by, reason and withdrawal end dates, with CSV and print](docs/screenshots/records.webp)

### 10. Documents

Vet reports, passports, TB test certificates, movement licences, insurance and receipts, attached to the farm, a group or a tagged animal. Anything expiring within 30 days is flagged at the top. File types are checked from the file's first bytes, not its name.

![Documents: expiring-soon list, and cards for a TB test certificate, feed invoice, insurance schedule, movement licence, cattle passport and flock health plan](docs/screenshots/documents.webp)

### 11. Cameras and counting

Use the phone as a camera on the animals (snapshots are saved to the farm's documents) and count a group through a gate with **tap-to-count**, compared with the head count on record. CCTV cameras are links to their own viewer pages. No machine learning: Bellwether doesn't try to diagnose or count from images.

![Cameras and counting: phone camera panel, tap-to-count tally, CCTV links](docs/screenshots/cameras.webp)

### 12. The farm's people, contacts and emergencies

Share a farm by email invitation as **Owner**, **Worker** (records treatments, moves groups, does tasks) or **Viewer** (reads only).

![People: an owner, a worker and a viewer, with an invite form](docs/screenshots/people.webp)

Vets, feed merchants and suppliers one tap from a call, and "find nearby" searches around the farm's postcode:

![Contacts and suppliers: the farm vet with out-of-hours and day numbers, feed merchants, and find-nearby links](docs/screenshots/contacts.webp)

The **Emergency** button is on every page. It lists out-of-hours numbers first, for every farm and pet, and links to the RCVS register to find a vet:

![Emergency page: call your vet now, out-of-hours lines first](docs/screenshots/emergency.webp)

### 13. Pets

Each pet has a record card (date of birth, breed, sex, microchip), a health plan with countdowns and opt-in email reminders, a weight chart, a **walk planner** that picks the cooler hours, its own tick and heatstroke forecast, a log and private documents.

![Bess the border collie: record card, health plan, weight chart, walk planner, forecast, log and documents](docs/screenshots/pet.webp)

![My pets: Bess, worming due today, and Tom, worming overdue](docs/screenshots/pets.webp)

### 14. Command palette

`⌘K` / `Ctrl+K` jumps to any page, farm, group or pet.

![Command palette finding the medicine cabinet](docs/screenshots/command.webp)

### 15. Dark mode and four colour schemes

The theme follows the device, or switches with one click. Each scheme (Pasture, Heather, Loch, Peat) has its own light and dark palette, and risk colours stay the same in all of them.

![Dashboard in the dark theme](docs/screenshots/dark-dashboard.webp)

![Weather and risk in the dark theme](docs/screenshots/dark-outlook.webp)

|                                              Heather                                              |                                            Loch                                             |                                            Peat                                             |
| :-----------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------: |
| <img src="docs/screenshots/pal-heather.webp" alt="Dashboard in the Heather scheme" width="270" /> | <img src="docs/screenshots/pal-loch.webp" alt="Dashboard in the Loch scheme" width="270" /> | <img src="docs/screenshots/pal-peat.webp" alt="Dashboard in the Peat scheme" width="270" /> |

|                                         Morning briefing, dark                                         |                                      Farm map, dark                                       |                                          Login, dark                                          |
| :----------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------: |
| <img src="docs/screenshots/dark-briefing.webp" alt="Morning briefing in the dark theme" width="270" /> | <img src="docs/screenshots/dark-map.webp" alt="Farm map in the dark theme" width="270" /> | <img src="docs/screenshots/dark-login.webp" alt="Login page in the dark theme" width="270" /> |

### 16. On a phone, in the field

Bellwether is built phone-first for people standing in a field: big tap targets, the Emergency button in the header, and nothing that scrolls sideways. It **installs to the Home Screen** and still shows pages you've opened when there's no signal (saving waits for a connection, and says so).

<p align="center">
  <img src="docs/screenshots/phone-dashboard.webp" width="250" alt="Farm dashboard on a phone" />
  <img src="docs/screenshots/phone-briefing.webp" width="250" alt="Morning briefing on a phone" />
  <img src="docs/screenshots/phone-pet-forecast.webp" width="250" alt="Pet forecast on a phone" />
</p>
<p align="center">
  <img src="docs/screenshots/phone-tasks.webp" width="250" alt="Tasks on a phone" />
  <img src="docs/screenshots/phone-cameras.webp" width="250" alt="Cameras and counting on a phone" />
  <img src="docs/screenshots/phone-emergency.webp" width="250" alt="Emergency page on a phone" />
</p>
<p align="center">
  <img src="docs/screenshots/phone-dark-dashboard.webp" width="250" alt="Farm dashboard on a phone, dark" />
  <img src="docs/screenshots/phone-dark-briefing.webp" width="250" alt="Morning briefing on a phone, dark" />
  <img src="docs/screenshots/phone-dark-pet.webp" width="250" alt="A pet's page on a phone, dark" />
</p>

---

## How it works

### In plain English

Think of Bellwether as a **farm office with a very well-informed weather watcher**:

- **The map clerk (postcodes.io)** turns a postcode into a point on the map. Fields can have their own pin, so a hill field and the farmyard can get different forecasts.
- **The weather watcher (Open-Meteo)** brings 14 days of forecast, hour by hour, and the season's past weather when it's needed.
- **The notebook (Redis)** remembers what the watcher said for an hour, so twenty people looking at the same farm don't ask twenty times. If the notebook is lost, the watcher is simply asked again.
- **The rule book (risk engine)** reads the weather for each group and writes down a level and the reason. It never looks anything up itself, which is why it's easy to test.
- **The filing cabinet (Postgres)** holds the farm: fields, groups, register, medicines, tasks, documents and who can see them.
- **The morning post (briefing job)** writes each farm's briefing every day and emails it to each member at the time they chose.

### The architecture

```mermaid
flowchart LR
    subgraph Client["Browser or installed phone app"]
        Web["React 18 + TypeScript<br/>Apollo Client · SVG charts · Leaflet<br/>service worker (offline reads)"]
    end

    subgraph Server["Bellwether API (Node 22)"]
        Yoga["GraphQL Yoga<br/>schema · resolvers · auth"]
        Services["Services<br/>forecast · briefing · farm · records · tasks · pets"]
        Engine["@bellwether/risk-engine<br/>pure TypeScript, no I/O"]
        Jobs["Jobs<br/>daily briefing · pet reminders"]
    end

    PG[("PostgreSQL 16<br/>Prisma 7")]
    Redis[("Redis<br/>postcode 30 d · weather 1 h")]
    Postcodes["postcodes.io"]
    Meteo["Open-Meteo<br/>forecast + archive"]
    SMTP["SMTP<br/>(Mailpit in dev)"]

    Web -- "GraphQL over HTTPS<br/>httpOnly session cookie" --> Yoga
    Yoga --> Services
    Services --> Engine
    Services --> PG
    Services -- "cache, falls back if down" --> Redis
    Services --> Postcodes
    Services --> Meteo
    Jobs --> Services
    Jobs --> SMTP
```

| Part            | What it does                                                                                                | Built with                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Risk engine** | One module per risk: weather in, level + score + reason out. A registry lists them all.                     | TypeScript (strict), no dependencies, no I/O                                                       |
| **API**         | Postcode and weather clients, caching, farms, groups, records, tasks, documents, sharing, briefings, emails | Node 22, GraphQL Yoga, Prisma 7, ioredis, Nodemailer                                               |
| **Database**    | Every farm record carries a `farmId`; farms belong to users through a membership table with a role          | PostgreSQL 16, 16 Prisma migrations                                                                |
| **Front end**   | Public forecast, farm and pet pages, map, charts, command palette, dark mode, installable PWA               | React 18, Vite, Apollo Client, hand-written SVG charts (no chart library), Leaflet + OpenStreetMap |
| **Delivery**    | Lint, format, typecheck, tests with coverage, build, and both Docker images on every push                   | GitHub Actions, Docker, nginx                                                                      |

### A forecast's journey

```mermaid
sequenceDiagram
    autonumber
    participant U as Farmer
    participant A as API
    participant C as Redis
    participant P as postcodes.io
    participant M as Open-Meteo
    participant E as Risk engine
    U->>A: farm briefing / outlook (GraphQL)
    A->>A: Check session, check farm membership
    A->>C: Location for the group's field?
    C-->>A: miss
    A->>P: Postcode → lat/long
    A->>C: Store for 30 days
    A->>C: Weather for rounded lat/long?
    C-->>A: miss
    A->>M: 14-day daily + hourly forecast
    A->>C: Store for 1 hour
    A->>E: assess(days, context) per module for the group's species
    E-->>A: [{date, level, score, reason}] × 14
    A-->>U: Risks per group, worst first, with reasons
```

If Redis is unreachable, the cache wrapper logs it and calls the API directly. If the weather service is down, the API returns a clear error code (and the briefing page shows the last stored briefing, with its time) instead of crashing.

---

## The risk engine

`packages/risk-engine` is the heart of the project: **pure functions, no I/O, 100% covered**. Every module implements one interface:

```ts
interface RiskModule {
  id: string; // 'blowfly'
  name: string; // 'Sheep blowfly strike'
  category: 'pet' | 'farm';
  animals: string[]; // ['sheep']
  assess(days: DailyWeather[], ctx?: RiskContext): DailyRisk[]; // level, 0–100 score, reason
}
```

**Adding a risk means one new file, one line in `registry.ts`, and its tests.** Nothing else in the codebase changes: the API, briefing, heatmap and charts pick it up from the registry.

| Module                   | For              | Rule summary                                                                                                                                                                      |
| ------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tick activity**        | Dogs, cats       | Mean < 5°C → Low · max ≥ 28°C and humidity < 60% → Low · mean ≥ 7°C and humidity ≥ 80% → High · else Medium · long grass/woodland raises one step                                 |
| **Dog heatstroke**       | Dogs             | Max < 20°C → Low · 20–25°C → Medium · > 25°C → High · the reason suggests the cooler hours, never treatment                                                                       |
| **Cattle heat stress**   | Cattle           | THI = (1.8T + 32) − (0.55 − 0.0055RH)(1.8T − 26). With hourly data: peak hourly THI and hours ≥ 72 · < 68 Low · 68–72 Medium · ≥ 72 High · housed groups get a note               |
| **Sheep blowfly strike** | Sheep            | Mean < 9°C → Low · mean ≥ 15°C and humidity ≥ 70% → High · else Medium · ≥ 2 mm rain the day before raises one step · unshorn, or shorn more than 42 days before, raises one step |
| **Newborn lamb chill**   | Sheep at lambing | Chill index C = (11.7 + 3.1√v)(40 − T) + 481 + 418(1 − e^(−0.04R)) kJ/m²/h · < 1000 Low · 1000–1100 Medium · ≥ 1100 High · only from lambing start to 3 days after it ends        |
| **Liver fluke season**   | Sheep, cattle    | Ollerenshaw index: for each month May–Oct, Mt = n(R − P + 5), capped, summed over the season · < 300 Low · 300–400 Medium · > 400 High · refreshed weekly from past weather       |

`calculateTHI`, the chill index and the Ollerenshaw sum are exported as their own functions and tested against hand-worked values.

### Honesty over false precision

- **Every threshold is a named constant** at the top of its module, commented as a heuristic and marked `TODO(verify source)`. None is presented as validated.
- **No invented citations.** Where a formula was read from secondary sources (the chill index, the Ollerenshaw index) the code and this README say so.
- **Known weak spots are stated.** A 2023 evaluation in the _Veterinary Record_ (Howell et al.) found the Ollerenshaw index not sensitive enough to rely on alone as an early warning, so Bellwether shows it as one season-level signal among several.
- **Some risks are deliberately not modelled.** Fleas live indoors with central heating all year, so weather is a poor predictor; Bellwether doesn't pretend otherwise.
- **No product or dose advice, enforced by a test.** Suggested checks are general husbandry ("Check the flock daily for signs of strike", "Speak to your vet or adviser about flystrike prevention"), and a test fails if any of them mentions mg, ml/kg or a dose.

### Thresholds still to verify

| Module             | Constant                                            | Value                         | Notes                                                                           |
| ------------------ | --------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| Tick               | `TICK_COLD_MEAN_C`                                  | 5 °C                          | Below this mean, Low                                                            |
| Tick               | `TICK_ACTIVE_MEAN_C` / `TICK_HUMID_PCT`             | 7 °C / 80 %                   | At or above both, High                                                          |
| Tick               | `TICK_HOT_MAX_C` / `TICK_DRY_PCT`                   | 28 °C / 60 %                  | Hot and dry, Low                                                                |
| Dog heatstroke     | `HEATSTROKE_MEDIUM_MAX_C` / `HEATSTROKE_HIGH_MAX_C` | 20 °C / 25 °C                 | Daily max                                                                       |
| Cattle heat stress | `THI_MEDIUM` / `THI_HIGH`                           | 68 / 72                       | Dairy cattle are often given lower bands                                        |
| Sheep blowfly      | `BLOWFLY_COLD_MEAN_C`                               | 9 °C                          | Below this mean, Low                                                            |
| Sheep blowfly      | `BLOWFLY_WARM_MEAN_C` / `BLOWFLY_HUMID_PCT`         | 15 °C / 70 %                  | At or above both, High                                                          |
| Sheep blowfly      | `BLOWFLY_RAIN_MM`                                   | 2 mm                          | Previous day's rain raises one step                                             |
| Sheep blowfly      | `BLOWFLY_FLEECE_DAYS`                               | 42 days                       | Fleece regrowth after shearing (~6 weeks)                                       |
| Lamb chill         | Formula coefficients                                | 11.7, 3.1, 40, 481, 418, 0.04 | From secondary sources (Nixon-Smith 1972; Donnelly 1984); originals not checked |
| Lamb chill         | `CHILL_MEDIUM` / `CHILL_HIGH`                       | 1000 / 1100 kJ/m²/h           | Band edges                                                                      |
| Lamb chill         | `NEWBORN_DAYS`                                      | 3 days                        | How long after the last lambing date lambs count as newborn                     |
| Liver fluke        | Formula `n(R − P + 5)` in inches                    | —                             | From secondary sources, not the 1959 paper (Ollerenshaw & Rowlands)             |
| Liver fluke        | `FLUKE_RAIN_DAY_MM`                                 | 0.2 mm                        | Rain-day threshold (Met Éireann's; others use 1 mm)                             |
| Liver fluke        | `FLUKE_MONTH_CAP` / `FLUKE_SHOULDER_MONTH_CAP`      | 100 / 50                      | Monthly cap; May and October halved                                             |
| Liver fluke        | `FLUKE_MEDIUM` / `FLUKE_HIGH`                       | 300 / 400                     | Season-total bands                                                              |

---

## Security and privacy

|                                       |                                                                                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔑 **Passwords done properly**        | Hashed with **scrypt** and a random salt per user; never stored or logged. Login failures never reveal whether the email or the password was wrong.                                                         |
| 🍪 **Revocable sessions**             | A random 256-bit token in an **httpOnly, SameSite=Lax** cookie (Secure in production). The database stores only its SHA-256 hash, and logging out deletes it.                                               |
| 🧑‍🤝‍🧑 **Farm-scoped by default**         | Every query and mutation that touches user data checks membership and role (Owner, Worker, Viewer). Someone else's farm simply comes back as "not found".                                                   |
| 🧪 **A test that can't be forgotten** | A second user tries **every operation in the GraphQL schema** against the first user's farm, field, group, pet and log, and checks nothing changed. Adding an operation without covering it fails the test. |
| 📄 **Safe uploads**                   | Only PDF, JPEG, PNG and WebP up to 5 MB, with the type read from the file's **first bytes**; file names stripped of paths and control characters. Documents are never cached for offline use.               |
| 📜 **Corrections, not deletions**     | Register entries and records are voided or corrected with a reason, so the history an inspector sees is complete.                                                                                           |
| 🧱 **Hardened web layer**             | nginx serves the app with a Content Security Policy and security headers; secrets live only in environment variables, with a `.env.example` and nothing committed.                                          |

---

## How the project was planned

Bellwether was built in deliberate stages, each one test-first, finished, documented and green in CI before the next began. Every open question was settled as a numbered decision ([docs/decisions.md](docs/decisions.md)), and larger stages had a written roadmap ([docs/roadmap-v3.md](docs/roadmap-v3.md)).

| Stage                              | What it delivered                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Scaffold**                    | npm workspaces monorepo, TypeScript strict, ESLint, Prettier, Vitest, Docker Compose for Postgres and Redis, CI                                         |
| **1. Risk engine, test-first**     | Types, registry, tick, heatstroke, THI and blowfly modules, every threshold boundary tested (just below, on, just above)                                |
| **2. API**                         | Postcode and weather clients behind interfaces, Redis cache with fallback, error codes, GraphQL schema, end-to-end tests with mocked HTTP               |
| **3. Front end**                   | Postcode forecast pages, risk cards, charts, disclaimer on every forecast page, loading and error states                                                |
| **4. A real farm**                 | Farms, fields, groups and moves in Postgres; sign-up, login and per-farm access control                                                                 |
| **5. Smarter engine**              | Hourly heat stress, fleece-aware blowfly, newborn lamb chill, liver fluke from the season's past weather                                                |
| **6. Records and the briefing**    | Treatments with withdrawal periods, checks, CSV and print; morning briefing page and daily email; tasks                                                 |
| **7. A working farm system**       | Dashboard, map and grazing, risk heatmap, holding register, medicine cabinet, calendar, task board, sharing with roles, pets in Postgres                |
| **8. In the field**                | Phone-first layouts, installable PWA with offline reads, pet reminder emails, demo accounts, photography, command palette, dark mode and colour schemes |
| **9. The rest of the farm office** | Contacts and emergency page, tagged animals, pet record cards, documents with expiry, cameras and tap-to-count, the lead-ewe brand                      |

Deployment is prepared but not live yet: both Dockerfiles build in CI, there is a production Compose file, and an Azure Container Apps guide is in [docs/deploy.md](docs/deploy.md).

---

## Design decisions

| Decision                                  | Why                                                                                                                                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rules, not machine learning**           | Farmers and vets must be able to check and argue with a risk. A rule with a named threshold and a reason can be checked; a model score can't. There is also no labelled outcome data to train on honestly. |
| **A pure, pluggable risk engine**         | No I/O means every rule is tested in milliseconds with exact inputs. One interface and a registry mean a new risk touches one file.                                                                        |
| **Risk per group, not per postcode**      | Shearing dates, lambing dates, housing and field location change the answer. The group is how farmers already think about their stock.                                                                     |
| **Most precise location wins**            | A field's map pin, then its postcode, then the farm's, so a hill field and the yard can differ.                                                                                                            |
| **GraphQL**                               | Pages ask for exactly what they show (a dashboard needs counts; a group page needs history), from one typed schema shared by tests and front end.                                                          |
| **Cache with a fallback**                 | Weather changes hourly and postcodes almost never; caching cuts load on free public APIs. Redis is an optimisation, never a dependency.                                                                    |
| **One contract suite, two repositories**  | The same tests run against the in-memory fake and real Postgres, so fast unit tests can't drift from the database.                                                                                         |
| **"Not found", never "forbidden"**        | Doesn't reveal that another farm's record exists.                                                                                                                                                          |
| **Levels in words, not just colour**      | Every risk shows "High" or "H" as well as red, for colour-blind users and bright sunlight.                                                                                                                 |
| **No dose, product or drug advice, ever** | It's a vet's job, not an app's. A test enforces it.                                                                                                                                                        |
| **Built-in auth instead of a provider**   | No third-party account or cost, works offline and in tests; swappable later behind `AuthService`.                                                                                                          |

---

## Getting started

### Prerequisites

Node 20+ (22 in CI) and Docker.

### Run it

```bash
npm install                   # also generates the Prisma client
cp .env.example .env          # optional; without it, Redis and Postgres fall back to in-memory stores
docker compose up -d          # Postgres (dev + test databases), Redis and Mailpit
npm run db:migrate            # apply database migrations
npm run dev:api               # http://localhost:4000/graphql
npm run dev:web               # http://localhost:5173 (proxies /graphql to the API)
```

Then open http://localhost:5173 and click **Explore a demo account**. Briefing and reminder emails land in Mailpit at http://localhost:8125.

### Demo logins

`npm run seed:demo -w @bellwether/api` creates named demo customers. All use the password `correct horse battery` (local development only).

| Email                      | What's there                                                   |
| -------------------------- | -------------------------------------------------------------- |
| `hill.farmer@example.com`  | A Lake District hill farm: sheep and cattle across five fields |
| `dairy.farmer@example.com` | A dairy farm                                                   |
| `mixed.farm@example.com`   | Two farms with a mix of stock                                  |
| `pet.owner@example.com`    | A dog and a cat                                                |

<details>
<summary><b>More: scripts, environment variables and production images</b></summary>

#### Scripts

| Command                                 | What it does                                |
| --------------------------------------- | ------------------------------------------- |
| `npm test`                              | All tests in every workspace                |
| `npm run test:coverage`                 | Tests with coverage (engine enforces ≥ 95%) |
| `npm run lint` / `npm run format:check` | ESLint / Prettier                           |
| `npm run typecheck`                     | TypeScript strict mode, every workspace     |
| `npm run build`                         | Production builds                           |
| `npm run db:migrate`                    | Create/apply Prisma migrations (dev DB)     |
| `npm run db:test:prepare`               | Apply migrations to the test DB             |

#### Environment

All configuration is in environment variables; see [.env.example](.env.example): `DATABASE_URL`, `REDIS_URL`, `TEST_DATABASE_URL`, the postcode and weather API base URLs, `SMTP_URL`, `APP_URL`, `BRIEFING_JOB_MINUTES`, `DEMO_ACCOUNTS` and `LOG_LEVEL` (`debug` logs cache hits and misses). The external APIs are free and need no keys.

#### Production images

`apps/api/Dockerfile` and `apps/web/Dockerfile` (nginx with security headers) build in CI on every push. `docker-compose.prod.yml` runs the whole stack; [docs/deploy.md](docs/deploy.md) walks through Azure Container Apps with managed Postgres and Redis.

</details>

---

## Tests

GitHub Actions runs lint, format check, typecheck, all tests with coverage (against a Postgres service container) and the production build on every push and pull request, then builds both Docker images.

```bash
npm test                                  # 1,134 tests (Postgres contract tests run when TEST_DATABASE_URL is set)
npm run test:coverage -w @bellwether/risk-engine   # 154 tests, 100% coverage
```

- **Risk engine (154):** written test-first. Boundary tests just below, on and just above every threshold; hand-worked THI, chill and fluke values; a contract test that runs every registered module over a grid of weather and checks each result has a valid level, a 0–100 score and a non-empty reason; registry tests for unique ids.
- **API (689):** external clients tested with mocked `fetch`; the GraphQL layer tested end to end through Yoga with fake clients, including invalid and unknown postcodes, weather API down, postcode API down and **Redis down**. A shared repository contract suite (84 tests) runs against the in-memory fake and real Postgres. The cross-user access test covers every operation in the schema. **No test ever calls a real external API.**
- **Front end (291):** React Testing Library tests for risk cards, the chart wrapper, the log form, the disclaimer on every forecast page, loading and error states, login and sign-up, the signed-in route guard, and the farm, field, group, task, register and document forms.

## Project structure

```
bellwether/
├── packages/
│   └── risk-engine/          pure TypeScript, no I/O
│       ├── src/
│       │   ├── types.ts      DailyWeather, RiskContext, DailyRisk, RiskModule
│       │   ├── registry.ts   every risk module, in one list
│       │   └── risks/        tick · dogHeatstroke · cattleHeatStress · sheepBlowfly · lambChill · liverFluke
│       └── test/             one test file per module, plus registry and contract tests
├── apps/
│   ├── api/                  GraphQL API (Node 22, Yoga)
│   │   ├── src/
│   │   │   ├── schema/       type definitions
│   │   │   ├── resolvers/    thin: auth and membership checks, then services
│   │   │   ├── services/     forecast, briefing, farm, records, register, tasks, pets, documents, demo accounts
│   │   │   ├── clients/      postcodes.io and Open-Meteo, behind interfaces
│   │   │   ├── cache/        Redis wrapper with in-memory fallback
│   │   │   ├── repositories/ Postgres (Prisma) and in-memory, one contract
│   │   │   ├── auth/         scrypt passwords, hashed session tokens
│   │   │   ├── jobs/         daily briefing, pet reminders
│   │   │   └── email/        briefing and reminder emails
│   │   ├── prisma/           schema and 16 migrations
│   │   └── test/
│   └── web/                  React front end (Vite, Apollo Client)
│       ├── src/
│       │   ├── pages/        25 pages: forecast, dashboard, briefing, map, register, medicines, pets…
│       │   ├── components/   risk cards, charts, heatmap, command palette, app shell…
│       │   └── assets/       farm photography and brand
│       └── test/
├── docs/                     decisions, roadmap, deploy guide, screenshots
├── docker-compose.yml        Postgres, Redis, Mailpit for development
└── .github/workflows/ci.yml  lint · typecheck · test with coverage · build · Docker images
```

## Limitations

- **Heuristic thresholds.** Every number in the engine is a starting heuristic until checked against UK veterinary and farming guidance (see [the list](#thresholds-still-to-verify)).
- **Weather, not animals.** Risk comes from the forecast only. Breed, age, body condition, local habitat and what's been done on the farm are not modelled, and housing is noted rather than modelled.
- **Forecast accuracy falls after about a week.** Days 8–14 are a guide, not a plan.
- **Daily averages hide peaks.** Heat stress uses hourly data; the other modules use daily values.
- **Lamb chill uses 10 m wind,** while the index was developed with wind nearer the ground, so it will tend to overstate chill.
- **Not live yet.** The containers and deploy guide are ready, but there is no hosted demo; run it locally in a few minutes.
- **Some sign-in hardening is deferred:** login rate limiting, email verification and password reset are listed in the decisions log for before a real launch.

## What's next

1. **A hosted demo** on Azure Container Apps (or a free tier), with real email.
2. **Verify and cite every threshold** against UK veterinary and farming guidance, and replace each `TODO(verify source)` with a reference.
3. **More risk modules,** for example nematodirus in lambs and coccidiosis, each one file plus tests.
4. **A vet or adviser view** of risk across the farms they look after.
5. **Optional plain-English weekly summary** written by a language model, with the rule-based score kept as the source of truth.

## Credits

- Postcode lookup: [postcodes.io](https://postcodes.io) (free, open data).
- Weather: [Open-Meteo](https://open-meteo.com) forecast and historical APIs (CC BY 4.0).
- Maps: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, via Leaflet.
- Farm and pet photography in the app was generated with Figma AI; no real farms or animals are shown.
- Display font: [Fraunces](https://github.com/undercasetype/Fraunces) (SIL Open Font License).

All farm names, people, phone numbers, ear tags and documents are fictional.

<p align="center">
  Built by <a href="https://github.com/samaunmahmud">Samaun Mahmud</a> · Computer Science (AI), Brunel University London
</p>
