# Architecture

GeoDex is a static, local-first PWA. There is no server and no account: the browser holds the learner's data and the build holds the world's data. Progress moves between browsers only as a backup file the learner downloads and restores (DECISIONS.md 043). This document explains the main design choices and what they cost.

## Layers

| Layer | Where | Rules |
|---|---|---|
| Pure engine | `src/engine/` | No React, no Dexie, no clock or randomness of its own. Scheduler, grading, budget, card unlocking, distractors, matching, session order, placement, session slices by length and focus, streaks and daily goals, memory levels and XP, achievements, stats, explanation selection. Unit tested; CI fails below 90% line coverage. |
| Study logic | `src/features/study/` | Turns world data, settings and card state into a day plan (`plan.ts`) and concrete questions (`questions.ts`). Pure functions over data, tested with the real data files. |
| Storage | `src/db/` | Dexie over IndexedDB: settings, device settings, review events, hook votes, card state cache. Backup files export and import all of it (`backup.ts`). |
| UI | `src/features/*`, `src/map/`, `src/ui/` | React 19, Tailwind, i18next. The map is SVG with d3-geo and d3-zoom. |
| Data pipeline | `scripts/data/` | Fetch once into `data/raw` (gitignored), build deterministically into committed `data/*.json`. |
| Content pipeline | `scripts/content/` | Templates compiled from Markdown, content linted against `content/VOICE.md`, `content/REVIEW.md` generated. |

## Event-sourced, local-first

Every answer is a `ReviewEvent`: card id, time, rating, mode, response time, what was chosen, which snippets were shown. Events are append-only; no code path updates or deletes one.

Card state (stability, difficulty, due date) is a cache. `replayAll` folds the events through the FSRS scheduler in time order and gives the same state on every device. The cache is rebuilt when a restored backup adds events, when scheduling settings change, and on load if it is missing.

Consequences:

- **Restoring cannot lose data.** Restoring a backup adds the events this browser does not have, by event id, and replays. Nothing is overwritten except the settings row, by last write wins.
- **Everything is derivable.** Streaks, daily goals, memory levels, XP, achievements, the mastery atlas, stats, hook effectiveness and confusion pairs are computed from events, never stored.
- **Reset without deletion.** "Start over" stores a time in the settings; replays and statistics read only events after it. The log stays intact.
- **Cost:** a full replay is linear in the number of events. At a few hundred reviews a day that is fine for years; the cache makes normal use incremental.

## Determinism

The same inputs give the same output everywhere:

- **Seeded randomness only.** Distractor choice, option order, explanation selection and placement order use a seeded PRNG keyed by card id and review count. A question looks the same on laptop and phone, and tests can assert exact output.
- **Deterministic data builds.** `pnpm data:verify` builds twice and requires byte-identical output. Fetches are cached in `data/raw`, and Natural Earth files are pinned to a release tag.
- **No clock in the engine.** Functions take `now` and the day-start hour as arguments.

## Data pipeline

Sources: Wikidata (names in both languages, capitals with roles, currencies, coordinates, QIDs), Natural Earth (country, marine, river, lake and region geometry), Wikimedia Commons (landmark photos and licenses), Språkrådet (Norwegian country names), UN M49 (regions), World Bank (population).

Wikidata is a starting point, not the truth. `data/curated/` holds the decisions it cannot make: which capital is primary, official languages, Norwegian names where the label differs from Språkrådet, which landmarks and features are in scope. Each build writes review reports for mismatches.

Physical features and history outlines are simplified per kind, given a label point inside the shape, and linked to the countries they touch. That link decides when their cards start: a river after a country it crosses, a dissolved state after half its successors, an empire after a third of its countries.

Ids never change once shipped: ISO 3166-1 alpha-3 for countries, Wikidata QIDs for everything else. If an entity disappears from the data, its cards are skipped and its events kept.

At runtime the data is fetched as JSON files and precached by the service worker, so the app works offline after the first load.

## Explanation engine

Feedback is chosen per answer from static content, never generated at runtime:

1. **Moment**: first introduction, correct, wrong, wrong with a known confusion, leech, mastered.
2. **Template** for the moment, in the learner's language, with slots filled from data (area, population, distance to the home country) and formatted with `Intl` for the locale.
3. **Hook**: one memory hook, weighted towards the hook types that have worked for this learner (the next review after a hook counts as a success or failure; "Not helpful" counts as a failure) and away from ones seen recently.
4. **Fact** or **contrast** text: facts by tier as the card matures; contrast text when the learner picked a known confusion.

Content is written per language, not translated, and linted for the voice rules (no filler, no praise, no dashes, length limits). Every fact stays in `content/REVIEW.md` until the author verifies it.

## Trade-offs

- **Static content over generation.** Explanations cannot adapt beyond what was written, but they are free, offline, reviewable and identical across devices.
- **Equal Earth over Mercator.** Honest areas; the cost is that small countries are tiny at world zoom, handled with tap markers and a zoom that frames the question.
- **No in-browser FSRS optimization.** The available optimizer needs cross-origin isolation, which would block the landmark photos in Safari (DECISIONS.md 039). Default FSRS-6 parameters apply.
- **Hand-drawn history outlines.** No permissively licensed dataset of empire extents exists; outlines are approximate and say so (DECISIONS.md 037).
- **Detailed map on phones.** The 1:50m world map keeps small countries recognisable but costs about half a second of drawing on a throttled phone, the main reason mobile Lighthouse performance is 64.

Every decision that deviates from or fills a gap in the plan is recorded in `DECISIONS.md`.
