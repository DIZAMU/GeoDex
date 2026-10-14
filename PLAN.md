# GeoDex: Build Plan

Author: DIZAMU (sole author). Spaced-repetition geography trainer. Local-first web app (installable PWA), laptop-first, with Supabase sync to phone. Zero running cost, no paid APIs, English and Norwegian.

Read `CONTRIBUTING.md` for working rules. Read `content/VOICE.md` before writing any learner-facing text.

---

## 0. Decisions locked with the author

| Topic | Decision |
|---|---|
| Name | GeoDex (repo `DIZAMU/GeoDex`) |
| Repo visibility | Private for now. Going public is the author's call at release (Phase 10) |
| Primary layout | Laptop first. Phone fully supported |
| Daily time | 15-20 min. New-card count adapts to fit the budget (6.3) |
| Start | Placement test, then home region outward |
| Scope | Countries (location, name, capital, flag, currency, language), major cities, landmarks, physical geography, history layer |
| Language | Full English / Norwegian (Bokmål) toggle for UI and content |
| Input | Per-session toggle: Auto / Multiple choice / Typing |
| Gamification | Streak, mastery map, region achievements. No XP, levels, leagues |
| Hook tone | Vivid and absurd images encouraged, dry humor allowed, always factually true |
| Timer | Invisible by default (affects grading only). Visible countdown available in settings |
| After answering | Always tap or press a key to continue. Feedback stays until dismissed |
| Reminders | None |
| Hosting | Author only. No public demo. Sign-ups disabled after the author's account exists |
| Portfolio | Yes: polished README, architecture docs, CI, screenshots, demo GIF |
| Themes | Atlas (dark, default), Minimal (light), Playful (colorful), Auto |
| User-written hooks | Not built. One-tap "Not helpful" on a hook instead |
| License | PolyForm Noncommercial 1.0.0 |
| Sync | Phone and laptop via Supabase, local-first |
| AI | None at runtime. Static content written per VOICE.md, selected dynamically |

---

## 1. Goals, non-goals, expected load

**Goals**
- Daily 15-20 minute sessions that produce durable recall across all modules.
- Target: 90% recall on any reviewed card (FSRS `request_retention: 0.90`).
- Offline on both devices, synced when online.
- Clonable and self-hostable free, with or without Supabase.
- Portfolio quality: tested engine, documented architecture, clean commit history.

**Non-goals (v1)**
- Public demo, other users' accounts, social features, leaderboards.
- Runtime AI generation or paid APIs.
- Notifications or reminders.
- Native apps.

**Expected load (the app must display this honestly)**

| Module | Items | Cards per item | Cards |
|---|---|---|---|
| Countries | 195 | 8 (6 core + currency + language) | 1,560 |
| Cities | ~200 | 2 | ~400 |
| Landmarks | ~120 | 3 | ~360 |
| Physical | ~85 | 2 | ~170 |
| History | ~70 | 2 | ~140 |
| **Total** | | | **~2,630** |

- With tap-to-continue and reading the feedback, assume ~10 s per card. 18 minutes is ~108 cards per day.
- Rough Anki heuristic: steady-state daily reviews are ~10 times daily new cards. So ~10-11 new cards per day fits the budget.
- Introducing everything takes ~8 months. The 6 core country cards alone take ~3.5 months. The placement test shortens both for what is already known.

---

## 2. Stack

| Layer | Choice | Reason |
|---|---|---|
| Build | Vite, React 19, TypeScript strict, pnpm | Author knows React/TS |
| Styling | Tailwind CSS v4, shadcn/ui (Radix) | Accessible primitives, restyled through theme tokens |
| Routing | React Router (library mode) | Simple SPA routing |
| i18n | i18next + react-i18next, typed keys | Free, mature, en + nb |
| Local DB | Dexie (IndexedDB) + dexie-react-hooks | Offline source of truth |
| Scheduler | ts-fsrs | FSRS, the algorithm Anki added in 23.10 |
| Maps | d3-geo (`geoEqualEarth`), d3-zoom, topojson-client, SVG | Control over hit-testing and fly-to, no tile server |
| Motion | Motion (formerly Framer Motion) | Respects `prefers-reduced-motion` |
| Sync/Auth | Supabase (Postgres, Auth, RLS), free tier, optional | Author knows it |
| PWA | vite-plugin-pwa (Workbox) | Install and offline |
| Fonts | Fontsource packages (self-hosted) | Offline, no third-party requests |
| Tests | Vitest, Playwright | Unit and e2e, desktop viewport primary |
| Lint/format | Biome | One tool |
| Hosting | Cloudflare Pages (free) | Author's instance only |
| CI | GitHub Actions | Private repos get a monthly free-minutes allowance: cache the pnpm store, run Playwright only on pushes to `main` |

Equal Earth projection is deliberate: Mercator inflates high latitudes (Greenland looks close to Africa's size; Africa is roughly 14 times larger) and would teach wrong sizes.

---

## 3. Licensing, attribution, contributions

- **Code and content:** PolyForm Noncommercial 1.0.0. Copy the official text verbatim into `LICENSE` from https://polyformproject.org/licenses/noncommercial/1.0.0/ and add:
  `Required Notice: Copyright (c) 2026 DIZAMU (https://github.com/DIZAMU/GeoDex)`
  The notices clause requires anyone redistributing to keep this line. That is the credit requirement.
- The repo is source-available, not OSI open source. README states: free for personal and noncommercial use, credit to DIZAMU required, commercial use not permitted.
- **Contributions:** sole author. Once the repo is public, README says issues are welcome for fact corrections; pull requests are not accepted.
- **Third-party data** listed in `THIRD_PARTY_NOTICES.md`:
  - Natural Earth: public domain.
  - world-atlas (TopoJSON build of Natural Earth): ISC.
  - flag-icons (lipis): MIT.
  - Wikidata: CC0.
  - Wikimedia Commons images (landmarks): per-image license; store author, license, URL; show attribution on the card. Accept only public domain, CC0, CC BY, CC BY-SA.
  - Historical border datasets (Phase 9): license must be verified before use; see 10.
- **Do not use** mledoze/countries or datasets derived from it (ODbL share-alike).

---

## 4. Architecture

Local-first. IndexedDB is the source of truth on each device. Supabase is a relay and backup. With no Supabase env vars set, the app runs fully local and hides sync UI.

**Core invariant: learning data is append-only events. Card state is a pure function of a card's events.**

- Each answer creates one immutable review event with a UUID. Each "Not helpful" tap creates one immutable hook-vote event.
- Sync is a set union of events across devices, deduplicated by UUID. No merge conflicts are possible.
- After a merge, FSRS state for affected cards is recomputed by replaying their reviews in `reviewedAt` order.
- FSRS parameters live in synced settings, so every device replays identically.
- Streak, stats, confusions, hook effectiveness, achievements and streak freezes are derived from events: retroactive and identical on every device.
- The only mutable synced data is the settings row, last write wins by `updatedAt`.
- Device-local settings (not synced): theme, last input mode, last session options.

```
 static data + content (bundled, versioned, en + nb)
              |
              v
       card generator ----> cards (deterministic ids)
              |
       session engine <---- scheduler (ts-fsrs) <---- cardState (derived cache)
              |                                             ^
              v                                             | replay
       answer + grading ----> events (append-only) ---------+
              |                     |
              v                     v  push unsynced / pull by server cursor
       explanation engine     Supabase (RLS)
```

---

## 5. Data model

### 5.1 Static data (generated by scripts, committed)

```ts
type Locale = "en" | "nb";
type L10n = Record<Locale, string>;
type L10nList = Record<Locale, string[]>;

type CapitalRole =
  | "primary" | "executive" | "legislative" | "judicial"
  | "constitutional" | "seat_of_government";

type Country = {
  id: string;                 // ISO 3166-1 alpha-3. Kosovo: "XKX"
  iso2: string;               // flag file key
  names: L10n;                // en "Germany", nb "Tyskland"
  officialNames: L10n;
  aliases: L10nList;          // en ["Czech Republic"], nb ["Tsjekkia"]
  prepNb: "i" | "på";         // "i Laos", "på Island", "på Cuba"
  continent: Continent;
  subregion: string;          // UN M49 subregion id
  status: "un_member" | "un_observer" | "partially_recognized" | "territory";
  capitals: { names: L10n; aliases: L10nList; role: CapitalRole; lat: number; lon: number }[];
  neighbors: string[];        // ISO3, land borders
  landlocked: boolean;
  areaKm2: number;
  population: number;
  populationYear: number;
  currencies: { code: string; names: L10n }[]; // ISO 4217
  currencyAsOf: string;       // build date; currencies change
  officialLanguages: { id: string; names: L10n }[]; // national level, curated
  centroid: [number, number];
  bbox: [number, number, number, number];
  wikidataId: string;
};

type City = {
  id: string;                 // Wikidata QID
  names: L10n; aliases: L10nList;
  countryId: string;
  lat: number; lon: number;
  population: number; populationYear: number;
  formerCapital: boolean;     // Lagos, Almaty, Karachi, Rio de Janeiro...
};

type Landmark = {
  id: string;                 // Wikidata QID
  names: L10n; aliases: L10nList;
  countryId: string;
  lat: number; lon: number;
  image: { file: string; author: string; license: string; sourceUrl: string };
};

type PhysicalFeature = {
  id: string;                 // Wikidata QID or Natural Earth id
  kind: "ocean" | "sea" | "river" | "mountain_range" | "desert" | "lake";
  names: L10n; aliases: L10nList;
  geometryRef: string;
};

type HistoricalEntity = {
  id: string;
  kind: "former_name" | "dissolved_state" | "empire";
  names: L10n; aliases: L10nList;
  period: [number, number];   // years; negative = BCE
  currentCountry?: string;    // former_name: ISO3
  successors?: string[];      // dissolved_state: ISO3[]
  geometryRef?: string;
  geometryApprox: boolean;
  snapshotYear?: number;      // year the outline represents
  sourceUrl: string;
};
```

Sources and rules:
- Wikidata SPARQL: names (en and nb labels), aliases, capitals with roles, area, population (most recent point in time), currencies (P38), coordinates, QIDs.
- Norwegian names: Wikidata nb labels, cross-checked against Språkrådet's list of country names. Mismatches logged to `data/name-mismatches.md`.
- `prepNb`: curated list in `data/curated/prep-nb.json` (islands and island states mostly take "på").
- Official languages: Wikidata P37 is noisy (regional languages mixed in). Use a curated override file `data/curated/official-languages.json`; Wikidata only as a starting point.
- world-atlas `countries-50m.json` for geometry. It uses ISO 3166-1 numeric ids; Kosovo, Somaliland and Northern Cyprus have none. Explicit mapping file, tested.
- Neighbors: `topojson.neighbors()` cross-checked with Wikidata P47; mismatches to `data/neighbor-mismatches.md`.
- Missing small countries in the 50m set: fall back to 10m geometry or a point marker.
- Cities: Natural Earth populated places (public domain) plus Wikidata. ~200, chosen as the largest non-capital city per country where notable, plus globally known cities, and every city commonly mistaken for a capital.
- Physical: Natural Earth marine polygons, rivers and lake centerlines, geography regions.

Multi-capital rule: `capital_to_country` uses the primary capital. `country_to_capital` accepts any listed capital in typed mode; feedback lists all with roles.

Default country scope: 193 UN members + 2 observers. Settings toggles add partially recognized states and territories. Borders follow Natural Earth's default de facto view, stated in README.

`data/flags-meta.json`: dominant colors per flag, extracted from SVG fills at build time.

### 5.2 Content (written per VOICE.md, committed)

`content/entities/<module>/<group>.json` (group = subregion for countries, continent for other modules):

```ts
type HookType = "anchor" | "shape" | "etymology" | "sound" | "story" | "flag_decode" | "contrast";
type Hook = { id: string; type: HookType; text: string; cardTypes?: CardType[] };
type Fact = { id: string; text: L10n; tier: 1 | 2 | 3; sourceUrl?: string; verified: boolean };

type EntityContent = {
  entityId: string;
  hooks: Record<Locale, Hook[]>;         // written natively per language, not translated
  capitalHooks?: Record<Locale, Hook[]>; // countries
  flagNote?: L10n;                       // countries
  facts: Fact[];                         // translated faithfully: same claim, both languages
};
```

Hooks are native per language because sound-alike and wordplay hooks do not survive translation. Facts are one claim with two renderings, so verification covers both.

`content/confusions.json`:

```ts
type Confusion = { a: string; b: string; dimension: "name" | "flag" | "capital" | "location" | "not_capital"; contrast: L10n };
```

Seed with at least:
- Names and locations: SVK/SVN, NER/NGA, AUT/AUS, GIN/GNB/GNQ/PNG, COG/COD, DMA/DOM.
- Flags: TCD/ROU, IDN/MCO, IRL/CIV.
- Capitals: Bratislava/Ljubljana.
- Not the capital: Sydney/Canberra, Istanbul/Ankara, Toronto/Ottawa, Rio de Janeiro/Brasília, Zurich/Bern, New York/Washington, Lagos/Abuja, Almaty/Astana, Karachi/Islamabad, Auckland/Wellington, Casablanca/Rabat, Dubai/Abu Dhabi, Ho Chi Minh City/Hanoi, Mumbai/New Delhi, Yangon/Naypyidaw, Dar es Salaam/Dodoma, Abidjan/Yamoussoukro.

`content/templates/<locale>/<moment>.md`: rule-based templates, see 7.

### 5.3 Cards (generated at runtime, deterministic)

Card id: `${entityId}:${cardType}`. Ids never change once shipped.

Countries:

| Stage | Card types | Unlocks when |
|---|---|---|
| 1 | `map_to_name`, `name_to_map` | Country introduced |
| 2 | `country_to_capital`, `capital_to_country` | Both stage 1 cards have stability >= 4 days |
| 3 | `flag_to_name`, `name_to_flag` | Both stage 2 cards have stability >= 4 days |
| 4 | `country_to_currency`, `country_to_language` | Both stage 3 cards have stability >= 4 days |

Stage 4 cards are one-directional on purpose: currency to country and language to country are ambiguous (euro, US dollar, CFA franc; Spanish, Arabic, French). `country_to_language` asks "Which is an official language of X?" and every distractor must not be an official language there.

Other modules:
- Cities: `city_to_country`, `city_to_map` (pin).
- Landmarks: `photo_to_name`, `landmark_to_country`, `landmark_to_map` (pin).
- Physical: `feature_to_map`, `map_to_feature`.
- History: `former_name_to_country`, `map_to_dissolved_state`, `dissolved_state_member` ("Which of these was part of X?"), `map_to_empire`, `empire_to_era`.

Pin grading: cities <= 100 km Good, <= 300 km Hard, else Again. Landmarks <= 150 km Good, <= 500 km Hard, else Again.

Unlocked cards count against the daily new-card budget.

### 5.4 Answer modes

Input mode is chosen per session (default: last used on that device):

**Auto** escalates with stability:

| Stability | Text cards | `name_to_flag` | Map cards |
|---|---|---|---|
| New or < 2 days | Multiple choice (4) | 4 flags | Zoomed to subregion |
| 2-14 days | Typed | 6 flags, look-alikes included | Zoomed to continent |
| > 14 days | Typed | 6 flags | Whole world, no hints |

**Multiple choice:** text cards always multiple choice; map cards stay zoomed to subregion. Ratings capped at Good. Stats shows the share of recognition-only reviews.

**Typing:** text cards always typed after the introduction; flag choice and map cards unchanged.

Rationale: multiple choice tests recognition, the weakest form of memory. Recall builds stronger traces. The toggle exists for convenience on phone; Stats keeps the trade-off visible.

### 5.5 Local DB (Dexie)

- `reviewEvents`: `id` (uuid), `cardId`, `reviewedAt` (ms), `rating` (1-4), `mode` (`mc` | `typed` | `map` | `pin` | `placement`), `inputSetting`, `correct`, `chosenAnswer`, `responseMs`, `snippetIds` (string[]), `scheduled` (false for drill and missed placement answers), `locale`, `deviceId`, `synced`.
- `hookVoteEvents`: `id` (uuid), `cardId`, `hookId`, `createdAt`, `deviceId`, `synced`.
- `cardState`: FSRS fields, cache only.
- `settings` (synced): `locale`, `homeCountry`, `dailyMinutes`, `newPerDayOverride`, `requestRetention`, `fsrsParams`, `dayStartHour`, `scope`, `modules`, `moduleWeights`, `countdownSeconds` (0 = off), `updatedAt`.
- `deviceSettings` (local only): `theme`, `lastInputMode`, `deviceId`.
- `syncMeta`: `lastPullSeq` per table.

Call `navigator.storage.persist()` on first run.

### 5.6 Supabase schema (`supabase/migrations/0001_init.sql`)

```sql
create table public.review_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id text not null,
  reviewed_at timestamptz not null,
  rating smallint not null check (rating between 1 and 4),
  mode text not null,
  input_setting text not null,
  correct boolean not null,
  chosen_answer text,
  response_ms integer,
  snippet_ids text[] not null default '{}',
  scheduled boolean not null default true,
  locale text not null,
  device_id text not null,
  server_seq bigint generated always as identity,
  created_at timestamptz not null default now()
);
create index review_events_user_seq on public.review_events (user_id, server_seq);
alter table public.review_events enable row level security;
create policy "select own" on public.review_events for select using (user_id = auth.uid());
create policy "insert own" on public.review_events for insert with check (user_id = auth.uid());

create table public.hook_vote_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id text not null,
  hook_id text not null,
  created_at_client timestamptz not null,
  device_id text not null,
  server_seq bigint generated always as identity
);
create index hook_vote_events_user_seq on public.hook_vote_events (user_id, server_seq);
alter table public.hook_vote_events enable row level security;
create policy "select own" on public.hook_vote_events for select using (user_id = auth.uid());
create policy "insert own" on public.hook_vote_events for insert with check (user_id = auth.uid());

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null
);
alter table public.user_settings enable row level security;
-- own-row select / insert / update policies
-- No update or delete policies on event tables: events are immutable.
```

Sync rules:
- Push: unsynced events in batches of 500, upsert ignoring duplicates on `id`. Idempotent.
- Pull: by `server_seq`, never by client timestamps, because an offline device can upload old events late. Pull from `lastPullSeq - 500` and dedupe by UUID: identity values can become visible out of commit order, and the overlap makes that harmless.
- Triggers: app open, session end, `visibilitychange` to hidden, every 5 minutes while open.
- Auth: email OTP code typed into the app, not magic links. iOS home-screen web apps have storage separate from Safari, so a magic link opened from Mail signs in the wrong context.
- **Security:** after creating the author's account, disable new sign-ups in Supabase Auth settings. The publishable key ships in the client bundle by design; RLS protects data, and disabled sign-ups stop strangers from creating accounts on the instance. README documents this step for cloners.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Absent means local-only mode.
- Size: ~200 bytes per event, ~40k events per year. Far below the free tier's 500 MB.
- Free projects pause after 7 days of inactivity. Daily use prevents it; if paused, the app keeps working locally and sync resumes after a manual restore.
- JSON export/import of all local data, independent of Supabase.

---

## 6. Learning engine (pure logic in `src/engine/`)

### 6.1 Scheduler
- ts-fsrs, `request_retention: 0.90` (settings range 0.80-0.95), short-term learning steps for new and lapsed cards. Check the installed version's API for exact parameter names.
- If fuzz is enabled, a test must prove replay is deterministic across devices.
- Personal parameter optimization: Phase 10, only if a browser-compatible FSRS optimizer exists. Verify first.

### 6.2 Automatic grading (no self-rating buttons)

| Outcome | Rating |
|---|---|
| Wrong, gave up, or countdown expired | Again (1) |
| Correct after hint, typed with an accepted typo, or slow | Hard (2) |
| Correct, normal speed | Good (3) |
| Correct, fast, in typed, map or pin mode | Easy (4) |

- Slow: > 2x the rolling median response time for that mode. Fast: < 0.6x. No Easy until 50 reviews exist for a mode.
- `responseMs` measures from prompt shown to answer submitted. Time spent reading feedback is never counted.
- Cap at 60 s; over the cap counts as Hard, not wrong.
- Multiple-choice input setting caps ratings at Good.

### 6.3 Session composition and time budget

New cards per day are computed from the time budget, not a fixed number:

```
secondsPerReview = rolling 14-day median of (prompt to continue), default 10
newCardCost      = 3 x secondsPerReview      // intro panel + learning steps
newToday = clamp( floor( (dailyMinutes*60 - dueToday*secondsPerReview) / newCardCost ), 0, 25 )
```

`newPerDayOverride` replaces the formula when set. Today shows "112 reviews + 9 new, about 18 min".

Order:
1. Due cards, lowest retrievability first, capped at 200 per day; overflow rolls over.
2. New cards in subregion batches of 5; a batch finishes before the next starts. Order after the placement test: the home country's subregion, then outward by distance between subregion centroids.
3. If the due backlog exceeds the budget by more than 50%, new cards pause.
4. Module allocation: new cards are drawn from enabled modules by `moduleWeights` (defaults: countries 3, cities 1, landmarks 1, physical 1, history 1). Non-country modules are off by default; the app suggests enabling them once all countries have been introduced at stage 1. They can be enabled any time.
5. Interleaving: never the same entity twice in a row; at most 2 consecutive review cards from the same subregion.
6. New card flow: `introduce` panel, then an immediate test, then learning steps.

### 6.4 Placement test
- Runs on first launch after choosing language and home country. Can be rerun per module from Settings.
- Adaptive by subregion: 2 probe questions (`map_to_name`, multiple choice). Both correct: test every country in that subregion, then capitals and flags for the ones placed correctly. Both wrong: mark the subregion unknown and move on.
- A correct placement answer writes a review event (`mode: "placement"`, rating Good). This seeds FSRS with a short first interval, so assumed knowledge is checked again within days.
- A wrong placement answer writes an event with `scheduled: false`. It does not touch scheduling, but its `chosenAnswer` feeds confusion tracking.
- Cap: ~15 minutes or 120 questions, resumable, skip per subregion.
- Result screen: the seeded mastery map, counts per skill, and where daily learning starts. No praise copy.

### 6.5 Distractors (multiple choice)
Priority: the user's own past confusion for this card, a curated confusion, same subregion, same continent. Flags prefer similar dominant colors. Random distractors from other continents are not allowed after a card's first review. Currency and language distractors must be verified incorrect for the target country.

### 6.6 Typed answer matching
- Accept names and aliases in both languages regardless of UI language ("Tyskland" and "Germany" are both correct).
- Normalize: lowercase, NFD with diacritics stripped, punctuation removed, whitespace collapsed, leading "the" removed. Treat æ/ae, ø/o, å/aa as equivalent.
- Damerau-Levenshtein threshold: 0 for length <= 4, 1 for 5-8, 2 for >= 9. An accepted typo grades Hard and shows the correct spelling.
- Reject if the input is within threshold of a different entity's accepted name (Niger/Nigeria, Austria/Australia, Guinea variants).
- Currency: accept name or ISO 4217 code.
- Input attributes: `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`, `autocomplete="off"`.

### 6.7 Confusion tracking
- Wrong answers store `chosenAnswer` (entity id for multiple choice, map and pin; typed text resolved to the nearest entity within distance 2).
- Pair score: occurrences in the last 90 days.
- Score >= 2 creates a contrast card `${a}|${b}:contrast` ("Which of these is X?", side by side), scheduled like any card.

### 6.8 Hooks: effectiveness and "Not helpful"
- For each shown hook, the next review of that card is a success or failure. Aggregate per hook type per user. Weight hook selection by the Beta(successes + 1, failures + 1) mean per type.
- "Not helpful" (one tap or key `N`) hides that hook for that card permanently and counts as one failure for its type.
- Stats shows "Hooks that work for you" per type.

### 6.9 Leeches
Lapses >= 6 marks a leech. The next review shows every remaining hook, the contrast card if a confusion exists, and a one-click drill for that card's region. Not suspended.

### 6.10 Streak
- Day boundary: `dayStartHour`, default 04:00 local.
- A day counts when the due count reaches 0, or 30+ scheduled reviews are done if the backlog is larger.
- Freezes: earn 1 per 7 consecutive counted days, hold at most 2, consumed automatically. Derived from events.
- Display: current, longest, 365-day calendar heatmap.

### 6.11 Achievements
Derived from events on replay; `earnedAt` is the first moment the condition held. Never revoked.
- **Region skill:** every card of a skill (location, capitals, flags, currency and language) in a subregion is in Review state with stability >= 21 days.
- **Continent skill:** all subregions of a continent for one skill.
- **World skill:** all 195 countries for one skill.
- **Module:** every item in cities, landmarks, physical or history at stability >= 21 days, per continent and overall.
- **Untangled:** a contrast card reaches stability >= 21 days.
- **Streak:** 7, 30, 100, 365 days.
Shown as badges on regions in the Atlas. New achievements appear on the session summary, never mid-session.

### 6.12 Drill mode
Free practice on a chosen region, module or confusion pair. Events logged with `scheduled: false`, excluded from FSRS and streak.

---

## 7. Explanation engine: static content, non-static delivery

Text is static, committed, and costs nothing. What appears is chosen per answer from: the moment, the learner's history with that card, which hook types work for them, and comparisons to their home country. Deterministic and offline.

### 7.1 Feedback panel
Stays on screen until the learner presses continue (click, tap, Enter or Space). For country cards it always shows: map with the country and labeled neighbors, flag, name in the current language (other language in smaller text), capital(s) with roles, then the moment content below. Other modules show their equivalent (pin with distance error, photo with attribution, outline with period).

### 7.2 Moments

| Moment | Trigger | Moment content |
|---|---|---|
| `introduce` | First exposure | 1 anchor hook, 1 tier-1 fact |
| `correct` | Correct, Good or Easy | 1 fact not yet seen (lowest unseen tier) |
| `correct_hard` | Correct, Hard | The hook type with the best track record for this learner |
| `wrong` | Wrong answer | Chosen vs correct side by side, the discriminating feature, then a hook |
| `lapse` | Wrong on a card in Review state | A hook of a different type than the one shown before the last success |
| `leech` | Lapses >= 6 | All remaining hooks, contrast card, drill link |
| `mastered` | Stability >= 60 days | Tier-3 fact, rotating |

### 7.3 Template files
`content/templates/<locale>/<moment>.md`. A file holds several variants; each is a frontmatter block followed by its body until the next `---`. `---` is banned inside bodies.

```md
---
id: wrong.location.basic
moment: wrong
cardTypes: [map_to_name, name_to_map]
requires: [chosen]
---
You picked {chosen.name}, in {chosen.subregion}. {target.name} is in {target.subregion}{?target.neighborsText:, next to {target.neighborsText}}.
---
id: wrong.location.home
moment: wrong
cardTypes: [name_to_map]
requires: [chosen, home]
when: target.distanceFromHomeKm > 1500
---
{target.name} is {target.distanceFromHome} {target.directionFromHome} of {home.name}. {chosen.name} is {chosen.distanceFromHome} {chosen.directionFromHome}.
```

Norwegian equivalent lives in `content/templates/nb/wrong.md` with the same ids, written natively.

Syntax:
- `{path}`: required slot; a variant with a missing required slot is ineligible.
- `{?path:text}`: optional segment.
- `when:` restricted grammar: `path op literal` clauses joined by `and`; ops `== != > < >= <=`. Hand-written parser. No `eval`, no `Function`.
- Compiled at build time by `scripts/content/compile-templates.ts` into `src/generated/templates.json`. Compile fails on syntax errors, unknown slots, or a template id present in one locale but not the other.

Computed slots (`src/engine/explain/slots.ts`), all locale-aware:
- `target.name`, `target.inName` (en "in Laos"; nb "i Laos", "på Island" via `prepNb`).
- `target.sizeVsHome`: area ratio r. 0.85-1.15 "about the same size as {home}"; > 1.15 "about N times the size of {home}"; 0.01-0.85 "about N% of {home}"; < 0.01 "under 1% of {home}". Skipped when target is home.
- `target.popVsHome`: same rules on population.
- `target.distanceFromHome`: haversine between primary capitals, rounded to 100 km, formatted with `Intl.NumberFormat` (en "8,100 km", nb "8 100 km"). `target.distanceFromHomeKm` is the raw number for `when`.
- `target.directionFromHome`: 8-point compass in the current language.
- `target.neighborsText`: up to 3 names, preferring neighbors the learner has the highest stability on, then "and N others" / "og N andre".
- `target.knownNeighbor`: highest-stability neighbor.
- `chosen.*`, `home.*`, `user.timesSeen`, `user.lastHookType`.

Numbers in learner-facing text come from slots. Hand-written numbers require a `sourceUrl`.

### 7.4 Selection algorithm
1. Collect eligible variants: locale, moment, card type, `requires`, `when`.
2. Drop variants shown for this card in its last 3 views, and hooks voted "Not helpful".
3. Weight: base 1; hooks by hook-type effectiveness (6.8); unseen facts x3.
4. Seeded random (seed = `cardId + reps`): a re-render or another device shows the same thing for the same review.
5. Output: at most 1 template block, 1 hook, 1 fact, 60 words total.
6. Missing Norwegian snippet: fall back to English for that snippet only. The linter makes this rare.

### 7.5 Customizing the voice
VOICE.md is the single source for tone. A cloner can edit it and the templates, then regenerate content with their own coding tools session. The linter enforces VOICE.md's machine-checkable section.

---

## 8. UI

### 8.1 Design direction
Subject: an atlas. Visual language comes from cartography, not SaaS dashboards. Design at 1440x900 first, then adapt to 390x844.

**Themes** (CSS variables under `[data-theme]`; map colors are part of each theme):

| Token | Atlas (dark, default) | Minimal (light) | Playful (colorful) |
|---|---|---|---|
| Background | `#0E2433` Abyss | `#F6F8FA` Snow | `#EAF6FF` Sky |
| Surface | `#18394C` Shelf | `#E3E9EE` Mist | `#FFFFFF` Cloud |
| Text | `#E7EEF2` Ink | `#1E2A35` Slate | `#22223B` Night |
| Accent | `#F4B740` Buoy | `#2F6F95` Fjord | `#6C4AB6` Grape |
| Secondary | | | `#FFC93C` Sunflower |
| Ocean on map | Background | `#E8F0F5` | `#CFEAFF` |
| Radius | 10 px | 6 px | 16 px |
| Weight | Regular UI, semibold names | Light hierarchy, thin borders | Semibold UI, bold names |

- **Auto:** Atlas when the system is dark, Minimal when light.
- **Mastery ramp** per theme, always sequential and luminance-monotonic, never red to green (about 8% of men have red-green color vision deficiency): Atlas slate to sea-green; Minimal light gray to deep blue; Playful viridis. Test each with a deuteranopia simulator.
- Correct and wrong states carry an icon and text, never color alone.

**Type**, following cartographic convention (land labels sans, water labels italic serif):
- Schibsted Grotesk: UI, country names, data.
- Newsreader Italic: oceans, seas, rivers, physical features, and hook text (marks a memory cue as distinct from data).
- Scale ratio 1.25. Body min 16 px on mobile. Lines under 80 characters. Same families in all themes.

### 8.2 The one memorable moment
On answer: the map flies to the target (~600 ms d3-zoom transition), the target fills with the accent, neighbors get labels, and on a wrong answer the chosen country gets a dashed outline and its own label so both are visible. Playful may use a slightly springier easing; that is the only motion difference between themes. Everything else stays quiet. Reduced motion: instant cut.

### 8.3 Screens
- **Today:** due + new counts with estimated minutes, Start session (with input mode selector: Auto / Multiple choice / Typing), streak, mastery map thumbnail, next region.
- **Placement:** intro line, adaptive test, result map.
- **Session:** desktop has the map on the left two thirds and the panel on the right; phone has the map in the top ~55% and the panel in a bottom sheet. Thin progress bar + "34 left". Optional countdown ring when enabled.
- **Session summary:** reviews done, today's retention, new achievements, tomorrow's forecast.
- **Atlas (the GeoDex):** full-screen mastery map with module switcher. Unseen items show as silhouettes. Region achievement badges. Entry pages: state of every card, capitals, flag, currency, languages, neighbors, cities, facts seen, review history sparkline.
- **Stats:** skill x continent grid, retention vs target (30 days), forecast (30 days), top confusions, leeches, hooks that work for you, recognition-only share, 365-day heatmap.
- **Settings:** language, home country, daily minutes or fixed new cards, target retention, day start hour, countdown (off / 10 / 15 / 20 s), scope toggles, modules and weights, theme, sync sign-in, rerun placement, export/import, reset.

Keyboard (laptop-first, all shown in a `?` overlay): 1-4 choose, typing auto-focused, Enter submit, Enter or Space continue, H hint, N not helpful, Esc end session.

Desktop session wireframe:
```
+--------------------------------------------+-----------------------+
| ==============--------              34 left|                       |
|                                            |  Which country is     |
|                                            |  this?                |
|                [ MAP ]                     |                       |
|        zoomed to region,                   |  [1] Slovenia         |
|        target unlabeled                    |  [2] Croatia          |
|                                            |  [3] Slovakia         |
|                                            |  [4] Austria          |
+--------------------------------------------+-----------------------+
```

Copy: sentence case, active verbs, no praise filler. Errors say what happened and how to fix it. Empty states say what to do next. All UI strings in both languages.

### 8.4 Quality floor
- Touch targets >= 44x44 px. Countries with a projected area under 30 px² at the current zoom get a tappable marker.
- Visible keyboard focus, WCAG AA contrast in all three themes, works at 360 px width.
- Installable PWA, offline after first load.

---

## 9. Repo structure

```
GeoDex/
  CONTRIBUTING.md
  PLAN.md
  DECISIONS.md               # deviations from the plan, ADR style
  LICENSE                    # PolyForm Noncommercial 1.0.0 + Required Notice
  THIRD_PARTY_NOTICES.md
  README.md
  docs/
    ARCHITECTURE.md
    media/                   # screenshots per theme, demo GIF
  content/
    VOICE.md
    REVIEW.md                # unverified facts awaiting the author's check
    templates/
      en/                    # introduce, correct, correct_hard, wrong, lapse, leech, mastered
      nb/
    entities/
      countries/             # <subregion>.json
      cities/                # <continent>.json
      landmarks/
      physical/
      history/
    confusions.json
  data/                      # generated, committed
    curated/                 # prep-nb, official-languages, seed lists
    countries.json cities.json landmarks.json physical.json history.json
    flags-meta.json
    geo/
    raw/                     # gitignored fetch cache
  public/flags/
  scripts/
    data/
    content/
  supabase/migrations/
  src/
    app/
    features/                # today, placement, session, summary, atlas, stats, settings
    engine/                  # pure logic, no React or Dexie imports
      cards.ts scheduler.ts session.ts budget.ts grading.ts matching.ts
      distractors.ts confusions.ts placement.ts streak.ts achievements.ts stats.ts
      explain/               # slots, when-parser, select, effectiveness
    map/
    db/                      # dexie schema, sync
    i18n/                    # en.json, nb.json, typed keys
    themes/
    generated/               # gitignored
    ui/
  tests/
```

---

## 10. Phases

Every phase ends with typecheck, lint, tests and build green, and a release tagged `v0.N.0` (DECISIONS.md 040). Do not start phase N+1 until phase N's acceptance criteria pass.

### Phase 0: Scaffold
- Vite + React + TS strict, Tailwind v4, shadcn init, Biome, Vitest, Playwright, React Router, Dexie, i18next (en + nb), Fontsource fonts.
- Theme system: Atlas, Minimal, Playful, Auto; theme switcher.
- `LICENSE`, `THIRD_PARTY_NOTICES.md`, `README.md` skeleton, `DECISIONS.md`, `docs/ARCHITECTURE.md` skeleton.
- GitHub Actions: lint, typecheck, test, build. Cloudflare Pages config.

Acceptance: placeholder Today screen renders in all three themes and both languages; CI green.

### Phase 1: Country data
- `fetch-wikidata.ts` (SPARQL, raw responses cached), `build-countries.ts` (merge, ISO numeric mapping, neighbors, nb names cross-check, `prepNb`, currencies with `currencyAsOf`, curated official languages), `build-flags.ts`.

Tests:
- Exactly 195 entities with status `un_member` or `un_observer`.
- Every country: >= 1 capital with coordinates, flag file, geometry or marker, continent, subregion, both names, `prepNb`, >= 1 currency, >= 1 official language.
- Neighbors symmetric.
- ZAF has 3 capitals with roles; BOL and NLD roles correct.
- en aliases include CZE "Czech Republic", TUR "Turkey", SWZ "Swaziland", MMR "Burma", CIV "Ivory Coast", CPV "Cape Verde", TLS "East Timor", MKD "Macedonia".
- nb names include DEU "Tyskland", AUT "Østerrike", GBR "Storbritannia", GRC "Hellas", NLD "Nederland", CIV "Elfenbenskysten"; nb capitals include DNK "København", RUS "Moskva", AUT "Wien", GRC "Aten".
- `prepNb` is "på" for ISL, CUB, LKA, MDG, MLT, CYP, JAM, PHL.

Acceptance: `pnpm data:build` run twice produces byte-identical output.

### Phase 2: Core loop, local only (start using it daily here)
- Card generator with stages 1-4 (stage 4 gated by the currency/language setting), ts-fsrs integration, session engine and time budget (6.3), grading (6.2), matching (6.6), distractors (6.5), confusion logging (6.7).
- Input modes and the per-session toggle (5.4). Countdown setting.
- `WorldMap`: Equal Earth, zoom, fly-to, hit-testing, small-state markers.
- Feedback panel (7.1) with placeholder moment text; continue only on user action.
- Placement test (6.4).
- Dexie schema, sync-ready from day one.

Tests: replaying events yields identical card state; budget formula; matching (accept Kyiv/Kiev, Tyskland/Germany, Cote d'Ivoire with or without accents, Østerrike typed as "osterrike"; reject Niger for Nigeria, Austria for Australia); placement seeds Good and logs misses unscheduled; no entity twice in a row; Playwright completes placement and a 10-card session at 1440x900 and 390x844.

Acceptance: a real daily session works on the laptop, starting from a placement result.

### Phase 3: Explanation engine and country content
- Template compiler, slot resolver, `when` parser, selection (7.4), hook effectiveness and "Not helpful" (6.8).
- Content linter (`scripts/content/lint.ts`) implementing VOICE.md's machine-checkable rules for both languages.
- Write templates for both locales, then country content one subregion per batch, both languages per batch, following `CONTRIBUTING.md`.
- Generate `content/REVIEW.md`.

Tests: every template compiles in both locales with matching ids; every moment has >= 1 eligible template per card type per locale; slot edge cases (Monaco, Russia, target equals home, "på" countries); no variant repeats within the last 3 views; 10 simulated reviews of one card show >= 4 distinct snippet combinations.

Acceptance: every answer shows a correct, varied explanation in both languages.

### Phase 4: Sync and PWA
- Supabase migration, email OTP, sync engine (5.6), offline queue, settings last-write-wins.
- vite-plugin-pwa: precache app shell, data, geometry, flags, fonts.
- README section: create the account, then disable sign-ups.
- JSON export/import.

Tests: property test with two simulated devices making interleaved offline reviews and hook votes that converge to identical state; duplicate pushes idempotent; app fully works with Supabase env vars unset.

Acceptance: review offline on the phone, reconnect, and the laptop shows the same due counts after one sync.

### Phase 5: Dashboard, achievements, streak, drill
- Today (final), session summary, Atlas with silhouettes, badges and entry pages, Stats (8.3), streak with freezes and heatmap, achievements (6.11), drill mode (6.12).

Acceptance: delete the `cardState` table, rebuild from events, and every screen is identical.

### Phase 6: Cities
- `build-cities.ts`: selection per 5.1, both languages, `formerCapital` flag.
- Card types and pin grading (5.3). "Not the capital" contrast cards seeded from `confusions.json`.
- Content per continent, both languages.

Acceptance: every seeded not-the-capital pair produces a working contrast card.

### Phase 7: Landmarks
- `content/landmarks.seed.json`: ~120 Wikidata QIDs chosen for global recognizability, at least 10 per inhabited continent.
- One Commons image per landmark with author, license and URL (allowed licenses only); runtime-cached after first view, not precached.
- Card types and pin grading (5.3). Content per continent, both languages.

Acceptance: attribution visible on every photo; previously seen photos load offline.

### Phase 8: Physical geography
- 5 oceans, ~20 seas, ~25 rivers, ~15 mountain ranges, ~10 deserts, ~10 lakes from Natural Earth.
- Water and feature labels in Newsreader Italic. River hit area: 16 px stroke.

Acceptance: every feature renders and is tappable at its default zoom.

### Phase 9: History layer
- **Former names** (~25), curated by how often the old name still appears in books and news. Examples: Zaire, Ceylon, Siam, Persia, Burma, Dahomey, Upper Volta, Abyssinia, Rhodesia, Northern Rhodesia, Nyasaland, Gold Coast, Bechuanaland, Basutoland, Kampuchea, East Pakistan, Dutch East Indies, British Honduras.
- **Dissolved states** (~8): USSR, Yugoslavia, Czechoslovakia, East Germany, West Germany, Austria-Hungary, Gran Colombia, United Arab Republic. Each with successors.
- **Empires** (~20) at a stated snapshot year: for example Roman, Byzantine, Mongol, Ottoman, Achaemenid Persian, Maurya, Mughal, Qing, Khmer, Mali, Songhai, Inca, Aztec, British, Spanish, Russian.
- **Borders-over-time explorer** in the Atlas: year slider, view only, not a quiz.
- **Data risk:** no clean, permissively licensed source for empire extents was identified during planning. Candidates to evaluate: CShapes 2.0 (modern state borders, 1886 onward) and community historical world basemaps. Verify each license and record the decision in `DECISIONS.md`. Share-alike or GPL data stays in separately licensed files or is not used. If no usable source exists, empires use hand-simplified outlines marked approximate, and the explorer covers only the period a verified dataset supports.

Acceptance: every outline shows its snapshot year and an "approximate" label where applicable.

### Phase 10: Polish and portfolio release
- Accessibility pass; list-based alternative to map and pin cards for screen readers.
- FSRS parameter optimization, only if feasible in the browser.
- In-app "Report a wrong fact" button opening a prefilled GitHub issue (no backend). Hidden while the repo is private.
- Visibility: before tagging `v1.0.0`, ask the author whether to make the repo public. The portfolio role and the report button need a public repo. Never change visibility without explicit approval.
- README: one-line description, demo GIF (record a scripted Playwright session, convert with ffmpeg), screenshots in all three themes, feature list, "How the memory engine works" (FSRS, recall escalation, confusion tracking, hook effectiveness, placement), Mermaid architecture diagram, self-hosting with and without Supabase, license and credit, author DIZAMU.
- `docs/ARCHITECTURE.md`: event-sourced local-first sync, determinism, data pipeline, explanation engine, trade-offs.
- CI badges, coverage threshold of 90% lines on `src/engine/`, Lighthouse scores in README.
- Tag `v1.0.0`.

There is no public demo, so the GIF and screenshots carry the portfolio role. Local-only mode already exists, so a visitor demo with no accounts is a small change later if wanted.

### Phase 11: Guidance, short sessions and levels

From a real user test: a first-time visitor did not understand what GeoDex is, what to do, or what they get out of it, and wanted shorter sessions with visible levels. Decisions made with the author (2026-10-14):

- Audience: teens and adults. Habit, not compulsion: no hearts, no lost-streak guilt, no notifications.
- The repository stays private; the report button stays hidden.

**11.1 Front page and guidance** (first)
- **Landing page** for new visitors (returning learners land on Today; reachable later from Help and Settings):
  - Hero: what GeoDex is, in one sentence, and headline-level "Free. No ads, no account, no tracking", with one line on why (made to help people learn geography).
  - Topic cards with icons and counts: countries, capitals, flags, currency and language, cities, groups, landmarks, physical geography, history.
  - What you get: a concrete knowledge list with numbers ("place all 197 countries, name every capital..."), a plain long-term memory promise (spaced repetition explained in two lines, "you will still know this in a year"), and a time estimate ("about N minutes a day, roughly M months to master everything", computed from the daily setting).
  - Visuals: the animated globe with topics lighting up, a 1 to 10 level path illustration, and a live mini demo of 3 varied questions (one map tap, one flag, one capital) with real feedback and a hook, not saved.
  - How it works in 3 steps, and one Start button.
- **Infobox on Today**: open by default for the learner's first week, then collapsed to one line ("What is GeoDex?") that expands on tap; state remembered.
- **Placement offered, not forced**: after choosing a home country, "Already know some countries? A 5-minute test skips them" with Take the test or Start from zero.
- **Interactive tour**: a spotlight walkthrough over the real screens after setup (Today, start a session, answer, feedback, Atlas, Stats, Settings, Help), skippable, replayable.
- **Floating help button** on every screen (except during a session, where `?` keeps the shortcut overlay): opens Help.
- **Help page** with the app map ("organisasjonskart"): a clickable diagram of Today, Session, Atlas, Stats and Settings and what each is for; plus short sections on how answers are graded and what levels mean, and "replay the tour".
- Acceptance: a new visitor at 1440x900 and 390x844 sees what GeoDex is, that it is free, what they can learn and get, and how to start, without scrolling past the first screen for the first three; the tour visits every main screen; Help is one tap from every screen; e2e covers the first-visit path in both languages.

**11.2 Session picker**
- "Start session" opens a picker: length 5, 10 or 20 questions (remembered), and a focus: Mixed (default: everything due today), or one skill (location, capitals, flags, currency and language), one module (countries, cities, groups, landmarks, physical, history) or one region (continent or subregion).
- The session holds exactly that many questions; the bar reads "3 of 10". Due cards come first, then new cards, both within the focus.
- A focused session shows how many due cards wait outside the focus, so the schedule never silently starves.
- Acceptance: each length and focus gives a session of that size and scope (unit tests on the queue builder, e2e on the picker).

**11.3 Levels, XP and the overview**
- **Memory level 1 to 10** for overall, each topic, each continent and each country: level = 1 + 9 x the weighted share of cards remembered (not started 0, started 0.2, holds a week 0.5, holds three weeks 0.8, mastered 1.0). It can go down when cards are forgotten. Shown with the next milestone ("18 cards to level 5").
- **XP**, which only goes up: correct answers (more for typing and world-map formats than multiple choice), finished sessions (scaled by length), the daily goal and streak days, and memory level-ups. XP levels have named ranks in both languages (Tourist, Traveller, Explorer, Navigator, Cartographer...). XP is derived from events like everything else, never stored.
- **Overview on Today**: level ring with the next milestone, the path to mastery (1 to 10 with your position), compact topic bars, XP level and streak, and a daily goal ring.
- **Celebration** on a memory level-up or rank-up: a short animation, respecting reduced motion.
- No gates: everything stays open; difficulty already rises as cards get stronger.
- Acceptance: levels and XP are pure functions in `src/engine/` with tests; the overview is screenshot-reviewed in all themes and both languages.

**11.4 Settings for goals**
- Topics I want (the module toggles, regrouped), daily goal (sessions or minutes, used by the time estimate, the goal ring and the streak), default session length and focus, and "show the welcome and tour again".

---

## 11. Risks

- **Content volume:** ~670 entities, ~8 snippets each, two languages: roughly 10,000 snippets. This is the largest use of coding tools in the project. Spread batches across sessions; English fallback per snippet keeps the app usable if Norwegian lags.
- **Content accuracy:** LLM-written facts will contain errors. Numbers come from slots or carry a source; `REVIEW.md`; report button.
- **History data:** availability and licensing uncertain (Phase 9).
- **Volatile data:** currencies and capitals change. Store `asOf` dates; rerun `data:build` yearly.
- **Official languages:** contested in some countries; the curated file is the source of truth and lists its sources.
- **Disputed borders and names:** Natural Earth de facto default, stated in README, scope toggles.
- **Supabase pause:** after 7 inactive days; local-first means nothing breaks.
- **iOS storage:** Safari can evict storage for sites not visited in 7 days; home-screen web apps are exempt. Install to the home screen and keep sync on.
