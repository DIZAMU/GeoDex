# Contributing to GeoDex

GeoDex is a spaced-repetition geography trainer by DIZAMU.

## Issues, not pull requests

Bug reports and wrong facts are welcome as [issues](https://github.com/DIZAMU/GeoDex/issues). For a wrong fact, quote the text, say what is wrong, and link a source. Pull requests from others are not accepted and will be closed: the code, the content and the design are kept by one author.

The rest of this file is how that author works.

## Where things are written down

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the app is built and why.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): every design decision, numbered, with its reasons and costs.
- [`content/VOICE.md`](content/VOICE.md): the voice for all learner-facing text.

## How to work

- Use conventional commits: `feat:`, `fix:`, `data:`, `content:`, `test:`, `docs:`, `chore:`. Keep commits small and focused, with clear messages. Run `git config core.hooksPath .githooks` once after cloning; the hook rejects attribution lines such as Co-authored-by trailers, and CI checks the same.
- Work on a branch and merge to `main` through a pull request once CI passes. `main` is what the live site runs.
- When reality conflicts with a decision (a library lacks a feature, data is missing, a license blocks a dataset), write the problem and the options in `docs/DECISIONS.md`, pick the safer one, and continue.
- When unsure about a library API (ts-fsrs, Dexie, vite-plugin-pwa, d3-zoom, i18next), read the installed version's types in `node_modules` or its current docs.

## Rules

- No dependency or service that costs money or needs an API key. No accounts and no backend: the app is static files.
- All content is static and committed. Nothing is generated at runtime.
- No runtime network requests except same-origin assets and Wikimedia Commons images for landmarks. No font CDNs, flag CDNs or tile servers.
- TypeScript strict. No `any` without a comment explaining why.
- Pure logic (scheduler, budget, grading, matching, distractors, session, streak, achievements, stats, levels, XP, explanation selection, slots) lives in `src/engine/` with no React or Dexie imports, and has unit tests.
- Deterministic everywhere: seeded randomness only.
- No em dashes or en dashes in any committed text: UI strings, content, templates, README, docs. The linter checks `content/`, `src/i18n/` and string literals in `src/`.

## Languages

- Two locales: `en` and `nb` (Norwegian Bokmål, not Nynorsk).
- No hardcoded UI strings. Every string goes through typed i18n keys, present in both `en.json` and `nb.json`. A missing key fails typecheck.
- Format numbers, distances and dates with `Intl` for the active locale (en "8,100 km", nb "8 100 km").
- Norwegian country phrases use `prepNb` ("i Laos", "på Island"). Never hardcode "i".
- Typed answers accept both languages regardless of the UI language.

## Invariants

1. Event tables (review events, hook votes) are append-only. Never update or delete an event.
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
pnpm data:build        # build static data from data/raw (deterministic)
pnpm content:compile   # templates md -> src/generated/templates.json
pnpm content:lint      # enforce VOICE.md rules, both locales
pnpm content:facts     # check content against the data, writes content/FACT-CHECK.md
pnpm content:nb        # new and changed Norwegian strings, writes NB-REVIEW.md (not committed)
```

## Definition of done

- Typecheck, lint and unit tests pass.
- New logic has tests.
- UI changes: Playwright screenshots at 1280, 768 and 390 px wide, in light and dark and both languages, checked by eye.

## Content

1. Read `content/VOICE.md` in full before every batch.
2. One group per batch (subregion for countries, continent for other modules), one commit per batch. Write both languages in the same batch.
3. Hooks: write natively in each language. Do not translate English sound-alike or wordplay hooks into Norwegian; invent Norwegian ones that work in Norwegian.
4. Facts: one claim, rendered faithfully in both languages.
5. Numbers and dates come from `data/` via slots. A fact that must contain a hand-written number or date needs a `sourceUrl` that was actually checked, and `verified: false` until the author confirms it.
6. Never invent a source URL. If a fact cannot be verified, set `verified: false` or drop it.
7. If a well-known mnemonic or "fact" is false, do not use it.
8. Run `pnpm content:lint` after each batch and fix every error before the next.
9. Regenerate `content/REVIEW.md` after each batch (all `verified: false` facts, grouped by module and group).

## Design

- Laptop first: design and verify at 1440x900, then adapt down.
- The map answer moment is the one place for visual boldness; keep everything else quiet. No generic dashboard look: no gradients, glows or decorative cards.
- One design in light and dark: the same layout, type and easing, with its own tokens for each mode.
- UI copy: sentence case, active verbs, no praise filler. Errors state what happened and the fix.
- Color never carries meaning alone. Mastery ramps are luminance-based, never red to green.
- Keyboard shortcuts work on every session screen and are listed in the `?` overlay.

## Releases

Each release has a notes file `releases/<tag>.md` for the version in `package.json`. Merging it into `main` publishes the GitHub release (`.github/workflows/release.yml`). Only the milestones stay as releases (every major version and the latest one); the notes of every version stay in `releases/`. A second workflow (`.github/workflows/branches.yml`) deletes branches once they are merged, so `main` is the only long-lived branch: work happens on a short branch per change.
