# CONTRIBUTING.md

GeoDex is a spaced-repetition geography trainer by DIZAMU (sole author). The full spec is in `PLAN.md`; section 0 lists decisions already made with the author, do not reopen them. The voice for all learner-facing text is in `content/VOICE.md`.

## How to work

- Build one phase at a time, in `PLAN.md` order. Before coding a phase, restate its tasks and acceptance criteria in one short list, then build.
- Do not start the next phase until every acceptance criterion of the current one passes.
- Commit after each completed task with conventional commits: `feat:`, `fix:`, `data:`, `content:`, `test:`, `docs:`, `chore:`. The history is part of the portfolio: small, focused commits with clear messages.
- If the plan conflicts with reality (a library lacks a feature, data is missing, a license blocks a dataset), write the problem and two options in `DECISIONS.md`, pick the safer one, and continue.
- When unsure about a library API (ts-fsrs, Supabase, vite-plugin-pwa, d3-zoom, i18next), read the installed version's types in `node_modules` or its current docs. Do not guess from memory.

## Hard rules

- The repo is `DIZAMU/GeoDex`, private. Never change its visibility, never add other remotes, never force-push `main`.
- No dependency or service that costs money or needs an API key. The only external service is optional Supabase.
- No LLM API calls from app code or scripts. All content is written by you during development and committed.
- No runtime network requests except Supabase, same-origin assets, and Wikimedia Commons images for landmarks. No font CDNs, flag CDNs or tile servers.
- TypeScript strict. No `any` without a comment explaining why.
- Pure logic (scheduler, budget, grading, matching, distractors, session, placement, streak, achievements, stats, explanation selection, slots, sync merge) lives in `src/engine/` with no React or Dexie imports, and has unit tests.
- Deterministic everywhere: seeded randomness only.
- No em dashes or en dashes in any committed text: UI strings, content, templates, README, docs. The linter checks `content/`, `src/i18n/` and string literals in `src/`.

## Languages

- Two locales: `en` and `nb` (Norwegian Bokmål, not Nynorsk).
- No hardcoded UI strings. Every string goes through typed i18n keys, present in both `en.json` and `nb.json`. A missing key fails typecheck.
- Format numbers, distances and dates with `Intl` for the active locale (en "8,100 km", nb "8 100 km").
- Norwegian country phrases use `prepNb` ("i Laos", "på Island"). Never hardcode "i".
- Typed answers accept both languages regardless of the UI language.

## Invariants (never break)

1. Event tables (review events, hook votes) are append-only. Never update or delete an event, locally or remotely.
2. `cardState` is a cache, fully rebuildable from events plus settings.
3. Card ids are `${entityId}:${cardType}` and never change once shipped.
4. Entity ids: ISO 3166-1 alpha-3 for countries (Kosovo `XKX`); Wikidata QIDs for cities, landmarks, physical features and history entities where they exist.
5. If an entity disappears from static data, skip its cards and keep its events.
6. Response time measures prompt to answer only. Time spent reading feedback never affects grading.

## Commands

```
pnpm dev               # dev server
pnpm build             # production build (runs content:compile first)
pnpm test              # vitest
pnpm test:e2e          # playwright, 1440x900 primary, 390x844 secondary
pnpm lint              # biome
pnpm typecheck
pnpm data:build        # fetch + build static data (deterministic)
pnpm content:compile   # templates md -> src/generated/templates.json
pnpm content:lint      # enforce VOICE.md rules, both locales
```

## Definition of done (per task)

- Typecheck, lint and unit tests pass.
- New logic has tests.
- UI tasks: Playwright screenshots at 1440x900 and 390x844, in all three themes and both languages, reviewed against `PLAN.md` section 8 before marking done.

## Content process (Phase 3 onward)

1. Read `content/VOICE.md` in full before every batch, not only the first.
2. One group per batch (subregion for countries, continent for other modules), one commit per batch. Write both languages in the same batch.
3. Hooks: write natively in each language. Do not translate English sound-alike or wordplay hooks into Norwegian; invent Norwegian ones that work in Norwegian.
4. Facts: one claim, rendered faithfully in both languages.
5. Numbers and dates come from `data/` via slots. A fact that must contain a hand-written number or date needs a `sourceUrl` you actually checked, and `verified: false` until the author confirms it.
6. Never invent a source URL. If you cannot verify a fact, set `verified: false` or drop it.
7. If a well-known mnemonic or "fact" is false, do not use it.
8. Run `pnpm content:lint` after each batch and fix every error before the next.
9. Regenerate `content/REVIEW.md` after each batch (all `verified: false` facts, grouped by module and group).

## Design

- Laptop first: design and verify at 1440x900, then adapt down.
- Follow `PLAN.md` section 8. The map answer moment is the one place for visual boldness; keep everything else quiet.
- Three themes share layout and type; only tokens, radii, weights and one easing differ.
- UI copy: sentence case, active verbs, no praise filler. Errors state what happened and the fix.
- Color never carries meaning alone. Mastery ramps are luminance-based, never red to green.
- Keyboard shortcuts work on every session screen and are listed in the `?` overlay.
