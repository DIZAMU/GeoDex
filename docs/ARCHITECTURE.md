# Architecture

GeoDex is a static, local-first PWA. There is no server and no account. The browser holds the learner's data and the build holds the world's data. Progress moves between browsers only as a backup file the learner downloads and restores ([decision 043](DECISIONS.md)). This document explains the main design choices and what they cost.

## Layers

| Layer | Where | Rules |
|---|---|---|
| Pure engine | `src/engine/` | No React, no Dexie, no clock or randomness of its own. Scheduler, grading, budget, card unlocking, distractors, matching, session order, session slices by length and focus, streaks and daily goals, memory levels and XP, achievements, stats, explanation selection. Unit tested, and CI fails below 90% line coverage. |
| Study logic | `src/features/study/` | Turns world data, settings and card state into a day plan (`plan.ts`) and concrete questions (`questions.ts`). Pure functions over data, tested with the real data files. |
| Storage | `src/db/` | Dexie over IndexedDB: settings, device settings, review events, hook votes, card state cache. Backup files export and import all of it (`backup.ts`). |
| UI | `src/features/*`, `src/map/`, `src/ui/` | React 19, Tailwind, i18next. The map is SVG with d3-geo and d3-zoom. |
| Data pipeline | `scripts/data/` | Fetch once into `data/raw` (gitignored), build deterministically into committed `data/*.json`. |
| Content pipeline | `scripts/content/` | Templates compiled from Markdown, content linted against `content/VOICE.md`, `content/REVIEW.md` generated. |

## Event-sourced, local-first

Every answer is a `ReviewEvent`: card id, time, rating, mode, response time, what was chosen, which snippets were shown. Events are append-only, and no code path updates or deletes one.

Card state (stability, difficulty, due date) is a cache. `replayAll` folds the events through the FSRS scheduler in time order and gives the same state on every device. The cache is rebuilt when a restored backup adds events, when scheduling settings change, and on load if it is missing.

Consequences:

- **Restoring cannot lose data.** Restoring a backup adds the events this browser does not have, by event id, and replays. Nothing is overwritten except the settings row, by last write wins.
- **Everything is derivable.** Streaks, daily goals, memory levels, XP, achievements, the mastery atlas, stats, hook effectiveness and confusion pairs are computed from events, never stored.
- **Reset without deletion.** "Start over" stores a time in the settings, and replays and statistics read only events after it. The log stays intact.
- **Cost.** A full replay is linear in the number of events. At a few hundred reviews a day that is fine for years, and the cache makes normal use incremental.

## Determinism

The same inputs give the same output everywhere:

- **Seeded randomness only.** Distractor choice, option order and explanation selection use a seeded PRNG keyed by card id and review count. A question looks the same on laptop and phone, and tests can assert exact output.
- **Deterministic data builds.** `pnpm data:verify` builds twice and requires byte-identical output. Fetches are cached in `data/raw`, and Natural Earth files are pinned to a release tag.
- **No clock in the engine.** Functions take `now` and the day-start hour as arguments.

## Data pipeline

Sources: Wikidata (names in both languages, capitals with roles, currencies, coordinates, QIDs), Natural Earth (country, marine, river, lake and region geometry), Wikimedia Commons (landmark photos and licenses), Språkrådet (Norwegian country names), UN M49 (regions), World Bank (population).

Wikidata is a starting point, not the truth. `data/curated/` holds the decisions it cannot make: which capital is primary, official languages, Norwegian names where the label differs from Språkrådet, which landmarks and features are in scope. Each build writes review reports for mismatches.

Physical features and history outlines are simplified per kind, given a label point inside the shape, and linked to the countries they touch. That link decides when their cards start: a river after a country it crosses, a dissolved state after half its successors, an empire after a third of its countries.

Ids never change once shipped: ISO 3166-1 alpha-3 for countries, Wikidata QIDs for everything else. If an entity disappears from the data, its cards are skipped and its events kept.

At runtime the data is fetched as JSON files and precached by the service worker, so the app works offline after the first load.

## Cards

A card is one fact asked one way. Its id is `${entityId}:${cardType}`, and ids never change once shipped.

Each country unlocks in four stages. A stage opens when both cards of the stage before it have a stability of at least 4 days:

| Stage | Cards |
|---|---|
| 1 | `map_to_name`, `name_to_map` |
| 2 | `country_to_capital`, `capital_to_country` |
| 3 | `flag_to_name`, `name_to_flag` |
| 4 | `country_to_currency`, `country_to_language` |

Stage 4 asks one way only on purpose: "which country uses the euro" or "where is Spanish official" has many right answers.

The optional topics add their own cards: cities and landmarks on a pin (`city_to_map`, `landmark_to_map`) and by country, landmark photos, rivers, seas and ranges on the map, groups of countries, and the history layer (former names, dissolved states, empires and their eras). A topic's cards start after the countries they belong to: a river after a country it crosses, a dissolved state after half its successors.

## How an answer becomes a rating

The learner never rates themselves. Grading turns what happened into an FSRS rating:

| What happened | Rating |
|---|---|
| Wrong, gave up, or the countdown ran out | Again |
| Right after a hint, with an accepted typo, or slowly | Hard |
| Right | Good |
| Right and fast, typed or on the map | Easy |

- Slow means more than twice the learner's median time for that kind of answer, once there are 10 answers to measure. Fast means under 0.6 times it, once there are 50. Over 60 seconds counts as Hard, never wrong.
- Picking from options tests recognition only, so it never earns Easy.
- Time runs from the question appearing to the answer. Reading the explanation never counts.
- Pins are graded by distance: within 100 km Good, within 300 km Hard (150 and 500 km for landmarks, which are often large).
- Typed answers accept names and aliases in both languages, ignore case, accents and punctuation, treat æ, ø, å as ae, o, aa, and allow 1 typo from 5 letters and 2 from 9. A typo that lands on another country's name (Niger, Nigeria) is wrong.

## The day plan

The day is planned from a time budget, not a fixed count. With the daily minutes from Settings and the learner's median time per answer over the last 14 days:

```
newToday = clamp(floor((minutes * 60 - due * secondsPerAnswer) / (3 * secondsPerAnswer)), 0, 25)
```

A new card costs about three answers (its introduction and the learning steps). The learner can raise the daily limit to 50 or 100. When the due cards alone would take more than one and a half times the budget, new cards pause until the backlog is down.

Due cards come first, least likely remembered first, at most 200 a day. New cards come in batches of five from one region, starting from the home country's region and moving outward. The same country never comes twice in a row, and at most two reviews in a row come from one region.

## Mix-ups, hooks and leeches

- **Mix-ups.** Every wrong answer stores what was chosen. Two mix-ups between the same pair within 90 days add a contrast card that shows both side by side. Wrong options favour the learner's own mix-ups first, then known look-alikes, then countries from the same region.
- **Hooks that work.** After a memory hook is shown, the next review of that card counts as a success or a failure for its hook type (shape, name, sound-alike, story). Hook types are then chosen by their success rate for this learner. "Not helpful" hides a hook for that card and counts as a failure.
- **Leeches.** A card forgotten six times shows every hook it has, its contrast card if there is one, and a drill for its region.
- **Drills** practise a region or a mix-up pair without touching the schedule or the streak.

## Progress

Everything here is computed from the events on replay:

- **Streak.** A day counts when the due cards reach zero, or after 30 reviews on a heavy day. A day starts at 04:00 by default. Every 7 counted days earn a freeze, at most 2, used automatically.
- **Memory level.** Each card counts by how long it is remembered (a week, three weeks, mastered), and the share of all cards maps onto levels 1 to 10 on a curve that makes early levels come quickly.
- **XP and ranks.** XP comes from sessions and days studied and never goes down. Ranks name stretches of XP.
- **Achievements.** A skill learned in a region, a continent or the world, a contrast card untangled, streak milestones. Never revoked.

## The interface

- **The map is the answer.** Questions are answered on an Equal Earth map, or on a globe for questions about the whole world. On an answer the map flies to the country, fills it, and labels its neighbours. A wrong pick is outlined too, so both are visible.
- **Two languages.** English and Norwegian are written separately, not translated, and every string exists in both. A test fails if a key is missing in one.
- **Accessible.** Every map answer can also be given from a list, by keyboard or with a screen reader. Touch targets are at least 44 px, contrast meets WCAG 2.2 AA in light and dark, and axe checks every screen in the end-to-end tests. Reduced motion turns the map's flights into cuts.
- **Offline.** A service worker precaches the app, the data and the fonts. Landmark photos are cached after their first view.

## Explanation engine

Feedback is chosen per answer from static content, never generated at runtime:

1. **Moment**: first introduction, correct, wrong, wrong with a known confusion, leech, mastered.
2. **Template** for the moment, in the learner's language, with slots filled from data (area, population, distance to the home country) and formatted with `Intl` for the locale.
3. **Hook**: one memory hook, weighted towards the hook types that have worked for this learner (the next review after a hook counts as a success or failure, and "Not helpful" counts as a failure) and away from ones seen recently.
4. **Fact** or **contrast** text: facts by tier as the card matures, and contrast text when the learner picked a known confusion.

Content is written per language, not translated, and linted for the voice rules (no filler, no praise, no dashes, length limits). Every fact stays in `content/REVIEW.md` until the author verifies it.

## Trade-offs

- **Static content over generation.** Explanations cannot adapt beyond what was written, but they are free, offline, reviewable and identical across devices.
- **Equal Earth over Mercator.** Honest areas. The cost is that small countries are tiny at world zoom, handled with tap markers and a zoom that frames the question.
- **No in-browser FSRS optimization.** The available optimizer needs cross-origin isolation, which would block the landmark photos in Safari ([decision 039](DECISIONS.md)). Default FSRS-6 parameters apply.
- **Hand-drawn history outlines.** No permissively licensed dataset of empire extents exists, so outlines are approximate and say so ([decision 037](DECISIONS.md)).
- **Detailed map on phones.** The 1:50m world map keeps small countries recognisable but costs about half a second of drawing on a throttled phone, the main reason mobile Lighthouse performance is 64.

The reasons behind each choice, numbered, are in [DECISIONS.md](DECISIONS.md).
