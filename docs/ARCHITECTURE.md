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

## Event sourcing

- Every answer is one immutable `reviewEvents` row, written when the learner continues (`responseMs` prompt to answer, `durationMs` prompt to continue).
- `cardState` is a cache: `recordReview` applies one event; a late, older event replays that card; `rebuildCardStates` replays everything. FSRS fuzz is off, so replay is identical on every device.
- Today, sessions and placement read the same pure plan (`src/features/study/plan.ts`): due cards, the time budget, new cards from home outward.

## Learning engine

Pure modules in `src/engine/` (no React or Dexie, enforced by a test): matching, grading, scheduler, cards, budget, distractors, confusions, session, placement, day boundaries, seeded randomness, and the explanation engine in `src/engine/explain/`.

## Sync

```
device A (IndexedDB)                     Supabase (Postgres, RLS)                device B
  reviewEvents synced=0 --push 500/batch--> review_events (id unique, server_seq) <--push--
                         <--pull seq > lastPullSeq-500, dedupe by id-- ------pull-------->
  settings (updatedAt) <------------- last write wins on user_settings ------------------>
```

- `src/sync/sync.ts` is the engine; `src/sync/backend.ts` defines the server it talks to, with an in-memory server for tests; `src/sync/supabase.ts` is the real one, loaded only when the `VITE_SUPABASE_*` variables are set.
- Pushes are idempotent (insert, ignore duplicate ids). Pulls go by server sequence, never by client time, starting 500 back so rows that became visible late are still seen.
- After new events arrive, the card state cache is rebuilt from all events; replay is deterministic, so devices converge (tested with two devices in random offline interleavings).
- Sign-in uses an emailed code; the app never creates accounts.

## Offline

`vite-plugin-pwa` precaches the app shell, all data and content chunks, the map geometry, flags and fonts, so the app works offline after the first load and installs to the home screen.

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

```
content/templates/<locale>/<moment>.md --compile-templates.ts--> src/generated/templates.json
content/entities/countries/<subregion>.json (hooks, capital hooks, flag notes, facts)
content/confusions.json (contrast text per look-alike pair)
                     |
answer -> moment (correct, correct_hard, wrong, lapse, leech, mastered; introduce on the intro panel)
       -> slots (target, chosen, home, user; locale-aware numbers, compass, neighbors)
       -> selection: eligible templates, recent views dropped, hooks weighted by what works
          for this learner, unseen facts first, seeded by card id and review count
       -> blocks (template, contrast, hook, fact), at most 60 words; snippet ids on the event
```

- `src/engine/explain/`: template syntax and the `when` grammar (hand-written, no eval), slots, selection and hook effectiveness. Pure and tested; its files use `.ts` imports so the content scripts run them under Node.
- `scripts/content/`: the template compiler (runs before `dev`, `build`, `typecheck` and `test`), the linter that enforces the YAML rules in `content/VOICE.md` in both locales, and the generator for `content/REVIEW.md`.
- "Not helpful" writes an append-only `hookVoteEvents` row; it hides that hook for that card and counts as a failure for its hook type.
- Contrast cards (`A|B:contrast`) appear after two confusions in 90 days when contrast text exists for the pair.
