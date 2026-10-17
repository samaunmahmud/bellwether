# Bellwether v3: from risk forecast to a working farm system

v2 forecast risk and kept treatment records, but a farmer still had to keep the rest of their
legal and day-to-day records somewhere else, and the interface was mostly forms and lists.
v3 makes Bellwether the place a small UK livestock farm (and a pet owner) runs from.

## What UK keepers have to record (research, October 2026)

- **Holding register**: holding (CPH) and flock/herd number, every movement on and off the
  holding, births/identification, deaths, tag replacements, and a head count on 1 December.
  Paper or electronic records are both accepted if an inspector can read them.
  ([NSA](https://nationalsheep.org.uk/keeping-things-legal-when-starting-a-flock/),
  [FAS](https://www.fas.scot/downloads/sheep-record-keeping-factsheet),
  [Staffordshire Trading Standards](https://www.staffordshire.gov.uk/business/trading-standards/farmed-species-information/sheep-and-goats))
- **Medicine book**: every medicine given to food-producing animals, kept for at least 5 years
  (already in Bellwether as treatment records).
- **Worm control**: SCOPS recommends faecal egg counts (FEC) before deciding to treat, and
  recording each FEC result with the group sampled and the date.
  ([FWI](https://www.fwi.co.uk/livestock/health-welfare/6-tips-on-how-to-carry-out-faecal-egg-counts),
  [GOV.UK worming treatment check](https://www.gov.uk/government/publications/sheep-worming-treatment-check))
- Leading farm apps (e.g. Herdwatch) combine herd/flock records, grazing and compliance in one
  place and work in the field.

Rules differ between England, Wales, Scotland and Northern Ireland; Bellwether keeps the records
but doesn't claim to file them with BCMS, LIS or ScotEID. `TODO(verify source)` stays on any
deadline we show.

## Features (24)

### Interface
1. **App shell**: a sidebar with a farm switcher, light/dark toggle and toast messages.
2. **Farm dashboard**: head count by species, groups in withdrawal, overdue tasks, the week's
   highest risks, recent activity and quick actions.
3. **Interactive farm map**: fields and groups on OpenStreetMap; click the map to pin a field.
4. **14-day risk heatmap**: every group × every risk × every day, colour and letter coded,
   with the reason on hover or tap.
5. **Weather panel**: 14-day temperature, rain and humidity chart for the farm.
6. **Farm calendar**: a month view of tasks, withdrawal end dates, lambing/calving windows and
   records.
7. **Task board**: drag tasks between To do and Done (with buttons as a keyboard fallback).
8. **Command palette** (Ctrl/⌘+K): jump to any farm, group, field or page.

### Holding register and records
9. **Holding details**: CPH number and flock/herd mark on the farm.
10. **Movements on and off the holding**: bought in, sold, to market or abattoir; head count,
    other holding and reference. Head count updates automatically.
11. **Deaths and losses**: count, cause, fallen-stock collection reference; head count updates.
12. **Births**: lambing and calving records (born alive, born dead); lambing/calving rate.
13. **Weighing sessions**: average weight per group, with a growth chart and daily live-weight
    gain (DLWG) between sessions.
14. **Faecal egg counts**: eggs per gram by group and date, charted (no treatment advice).
15. **Body condition scores**: average score per group over time.
16. **Tag replacements**: count and note, as the register requires.
17. **Holding register view and export**: running head count with every change, and the
    1 December count, as CSV or print.
18. **Medicine cabinet**: products on hand with batch, quantity and expiry; expiring and
    expired items flagged; picking one fills the treatment form.
19. **Farm performance**: mortality rate, lambing/calving rate, average DLWG over 12 months.
20. **Activity feed**: who recorded what and when, across the farm.
21. **Grazing rotation**: days each field has been grazed or rested, from group moves.
22. **Notification centre**: overdue tasks, withdrawals ending, medicines expiring, in one list.

### Pets
23. **Pet health plan**: vaccinations, flea/tick/worm treatments and check-ups with next due
    dates and a countdown; weight log with a chart.
24. **Walk planner**: today's hourly temperature with the coolest times to walk a dog highlighted.

### Demo data
A **"Try a demo farm"** button builds a realistic farm (fields, groups, a season of records) so
the app can be explored without typing everything in.

## Rules kept from v1 and v2
- No dosing or product advice; products are typed by the farmer from the label.
- Rule-based, explainable risk; heuristics labelled `TODO(verify source)`.
- Every change checked by role on the API (FR-8.2).
