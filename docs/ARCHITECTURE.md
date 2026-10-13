# Architecture

Skeleton. Filled in as each phase lands; the full write-up is a Phase 10 task.

## Overview

Local-first single-page app. IndexedDB (Dexie) is the source of truth on each device. Supabase, when configured, relays and backs up append-only event tables. Without Supabase environment variables the app runs fully local.

## Layers

| Layer | Location | Notes |
|---|---|---|
| App shell and routing | `src/app/` | React Router, `createBrowserRouter` |
| Features | `src/features/` | One folder per screen |
| Engine | `src/engine/` | Pure logic, no React or Dexie imports, unit tested (Phase 2) |
| Map | `src/map/` | d3-geo Equal Earth, SVG (Phase 2) |
| Storage and sync | `src/db/` | Dexie schema; sync engine in Phase 4 |
| i18n | `src/i18n/` | i18next, typed keys, en and nb with enforced key parity |
| Themes | `src/themes/` | CSS tokens per `[data-theme]`, WCAG AA checked in tests |
| UI primitives | `src/ui/` | shadcn components on Radix |

## Settings storage

- `settings` (synced, last write wins by `updatedAt`): locale today; more fields in Phase 2.
- `deviceSettings` (never synced): device id and theme preference.
- Theme and locale are mirrored to `localStorage` for the first paint only (`DECISIONS.md` 005).

## Event sourcing and sync

Phase 2 and Phase 4. See `PLAN.md` sections 4 and 5.6.

## Data pipeline

```
fetch (network, cached in data/raw)        build (offline, deterministic)
  Wikidata SPARQL  ----------------\
  Språkrådet state names ----------+---> build-countries.ts ---> data/countries.json
  UN M49 table ---------------------+          ^                  data/geo/countries-50m.json
  World Bank population -----------/           |                  data/*.md reports
                                    data/curated/*.json
  world-atlas, flag-icons (npm) ---------> build-flags.ts ------> public/flags, data/flags-meta.json
```

- Fetch and build are separate so the build runs offline and twice gives the same bytes (`pnpm data:verify`).
- Curated files decide where Wikidata is noisy; every difference is written to a report for review.
- Types for all generated data live in `src/data/types.ts`, shared by scripts and app.

## Explanation engine

Phase 3. See `PLAN.md` section 7.
