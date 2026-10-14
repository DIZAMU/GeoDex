# Decisions

Deviations from `PLAN.md` and choices the plan left open, in ADR style. Newest last.

## 001. Node 24 LTS, pinned

- **Context:** the cloud development container ships Node 22. `PLAN.md` and `SETUP.md` require Node 24.
- **Options:** (a) relax to Node 22, (b) install Node 24 through nvm and pin it.
- **Decision:** (b). `.nvmrc` holds `24`, `package.json` has `engines.node >=24`, CI reads `.nvmrc`, Cloudflare uses `NODE_VERSION=24`. Node 24 also runs the TypeScript scripts in `scripts/` directly through type stripping, without a loader dependency.

## 002. TypeScript 7

- **Context:** TypeScript 7.0 (the native compiler) is the current `latest` release.
- **Decision:** use 7.0.2. Nothing in the toolchain depends on the TypeScript JavaScript API: Vite transpiles on its own and Biome lints. `tsc -b` with project references and the i18next key types work. If a later tool needs the old JavaScript API, fall back to 6.x and record it here.

## 003. shadcn/ui without the CLI as a dependency

- **Context:** `shadcn init` 4.x adds the `shadcn` CLI package and the pre-1.0 `cn` package as runtime dependencies, imports `shadcn/tailwind.css`, and installs the Geist font.
- **Options:** (a) accept the generated setup, (b) keep `components.json`, generate components with `pnpm dlx shadcn@<version> add`, and own the rest.
- **Decision:** (b). `cn` is built from `clsx` and `tailwind-merge`. The few custom variants the components need are copied into `src/app/index.css`. Components live in `src/ui/`.

## 004. Theme tokens adjusted for WCAG AA

- **Context:** Minimal's Fjord `#2F6F95` on Mist `#E3E9EE` is 4.48:1, under the 4.5:1 AA minimum for text. Playful's Sunflower `#FFC93C` on white is 1.5:1.
- **Decision:** Fjord becomes `#2B698E` (4.88:1 on Mist, 5.61:1 on Snow). Sunflower is used for fills only, with Night text on top (10.1:1). `src/themes/contrast.test.ts` checks every text pair at 4.5:1 and every focus and map outline pair at 3:1 in all three themes.

## 005. Pre-paint mirror of theme and locale

- **Context:** Dexie is asynchronous, so a theme or language read from IndexedDB arrives after the first paint and the page flashes.
- **Decision:** Dexie stays the source of truth. The theme preference and locale are also written to `localStorage` (`geodex.theme`, `geodex.locale`). An inline script in `index.html` applies the theme before first paint, and i18next starts with the mirrored locale. When Dexie loads, its values win and rewrite the mirror.

## 006. Default 44 px targets on shadcn controls

- **Context:** generated shadcn buttons and toggles default to 32 px, below the 44 px floor in `PLAN.md` 8.4.
- **Decision:** default and large sizes raised to 44 px and 48 px. Selected toggles carry an underline and a heavier weight, so selection is not shown by color alone.

## 007. Dash check before the content linter exists

- **Context:** the no-dash rule applies to all committed text, but `content:lint` arrives in Phase 3.
- **Decision:** `scripts/lint/no-dashes.ts` runs in `pnpm lint` over every tracked text file. `LICENSE` and `public/licenses/` are exempt because they are verbatim third-party texts. The banned characters are built with `String.fromCodePoint` because Biome rewrites `\u` escapes into literal characters.

## 008. Branch flow and phase tags

- **Context:** development happens on a feature branch; `main` receives work through pull requests.
- **Decision:** merge pull requests with a merge commit, not squash, so the per-task commit history stays on `main`. The `phase-N` tag goes on `main` after the merge.

## 009. Playwright browser override

- **Context:** the cloud container has a preinstalled Chromium that does not match Playwright's pinned revision, and browser downloads are disabled there.
- **Decision:** `playwright.config.ts` reads an optional `PW_CHROMIUM_PATH`. CI installs Playwright's own Chromium and leaves it unset.

## 010. Phase tags are created by the author

- **Context:** the cloud session's git proxy rejects tag pushes (HTTP 403); branch pushes work.
- **Decision:** phases are recorded here with their completing commit on `main`. The author creates the `phase-N` tags: `git tag -a phase-N <sha> -m "Phase N" && git push origin phase-N`.
- **Record:** phase-0 is `d4c7a46`.

## 011. Entity scope beyond the 195

- **Context:** `PLAN.md` asks for scope toggles for partially recognized states and territories.
- **Decision:** Phase 1 builds the 195 plus Kosovo (`XKX`) and Taiwan (`TWN`) as `partially_recognized`, off by default. Territories (Greenland, Puerto Rico and others) are deferred; they draw on the map as land but are never asked. Western Sahara, Somaliland and Northern Cyprus draw as land too.

## 012. Primary capitals

- **Context:** ten countries have more than one capital or a contested one. `capital_to_country` needs one answer; typed `country_to_capital` accepts every listed capital.
- **Decision (in `data/curated/capitals.json`):** the constitutional or official capital is primary. BOL Sucre (La Paz seat of government), NLD Amsterdam (The Hague), ZAF Pretoria (Cape Town, Bloemfontein), CIV Yamoussoukro (Abidjan), BEN Porto-Novo (Cotonou), MYS Kuala Lumpur (Putrajaya), LKA Sri Jayawardenepura Kotte (Colombo), SWZ Mbabane (Lobamba), YEM Sanaa (Aden), PSE East Jerusalem (Ramallah). Every other country uses its single current Wikidata capital.
- **Type change:** a capital has `roles: CapitalRole[]` instead of one `role`, since Amsterdam is both primary and constitutional. Capitals also carry their Wikidata id.

## 013. Population from the World Bank

- **Context:** Wikidata P1082 mixes years (many 2017 imports, Nicaragua 2005, India 2020 at 1.33 billion).
- **Options:** (a) Wikidata latest statement, (b) World Bank SP.POP.TOTL, latest year, Wikidata only where missing.
- **Decision:** (b). One consistent year (2025) for every country except Taiwan and the Holy See, which use Wikidata. Free, no key, CC BY 4.0.

## 014. Names: UN short names in English, Språkrådet in Norwegian

- **Decision:** English names follow the Wikidata label, overridden with the UN short name where they differ (Czechia, Türkiye, Côte d'Ivoire, Cabo Verde). Former and common names become aliases (Czech Republic, Turkey, Ivory Coast, Cape Verde). Norwegian names follow Språkrådet's preferred form unless the Wikidata label is one of Språkrådet's accepted forms. Språkrådet's live page is used, because the CC BY copy on Språkbanken dates from 2012 (it still lists Swaziland). Ambiguous aliases (Congo, Korea, Guinea) are not added.
- **Wikidata labels** fall back to `mul` (language-neutral) when `en` is missing; several capitals only have `mul` labels.

## 015. Curated currencies and official languages

- **Context:** Wikidata P38 and P37 are noisy (Zimbabwe lists 13 currencies; Russia lists 36 languages including regional ones; the USA list has no English).
- **Decision:** `data/curated/currencies.json` and `official-languages.json` are the source of truth; the build reports every difference from Wikidata. Currencies: those in circulation as legal tender, including widely used second currencies (USD in Zimbabwe, ZAR in Lesotho, Namibia, Eswatini, INR in Bhutan). Languages: national-level official status, de jure or de facto, no regional-only or sign languages. Lists are complete for every language in the table, so a distractor is never an official language. `excludeAsDistractor` covers languages with ambiguous or recently changed status (French in Burkina Faso, Mali, Niger after 2023 to 2025 changes; Arabic in Israel; Russian in Tajikistan and the former Soviet states).
- **Review:** Burkina Faso, Mali and Niger language lists reflect constitutional changes the author should confirm.

## 016. Geometry details

- **Small states:** Tuvalu has no shape in the 50m set and is drawn as a marker at its capital. Natural Earth 10m would add it, but the 10m file is about 5 times larger (3.7 MB vs 0.76 MB).
- **Centroid and bbox** come from each country's largest polygon, so French Guiana does not pull France's centroid into the Atlantic. Neighbors use the full shape, so France borders Brazil and Suriname.
- **Kosovo** has no ISO numeric code and is matched by name. "Ashmore and Cartier Is." reuses Australia's code and is excluded.
- **Neighbors** come from shared borders in the geometry. Wikidata P47 includes sea borders and is a cross-check only (`data/neighbor-mismatches.md`).

## 017. Flag colors

- **Decision:** flags are rasterized with resvg at build time and each pixel maps to the nearest of 9 named colors (red, maroon, orange, yellow, green, light blue, blue, white, black). `data/flags-meta.json` keeps colors covering at least 5 percent. Distractor selection compares these names. resvg (MPL-2.0) is a build-time tool and does not ship.

## 018. Norwegian prepositions

- **Decision:** `data/curated/prep-nb.json` lists the countries that take "på", mostly island states. Choices the author should confirm are listed under `uncertain` (Bahrain, Kiribati, Nauru, Palau, Singapore, Øst-Timor, Tuvalu, Vanuatu).

## 019. Cloudflare Workers static assets instead of Pages

- **Context:** connecting the repository in the Cloudflare dashboard created a Worker, not a Pages project; Cloudflare now routes new Git-connected sites to Workers. `geodex.pages.dev` also belongs to an unrelated site.
- **Options:** (a) delete the Worker and create a Pages project, (b) keep the Worker and serve `dist/` as static assets.
- **Decision:** (b). Free tier, same build. `wrangler.jsonc` is committed so the deploy is defined by the repository, not dashboard state; `wrangler` is a pinned dev dependency so the build uses a known version. `pnpm-workspace.yaml` allows the install scripts of `esbuild` and `workerd`, which wrangler needs.

## 020. Brand pack

- **Context:** the author delivered a final brand pack (mark, wordmark, lockups, app and web icons, social images) with `BRAND.md` and handoff steps.
- **Decision:** `assets/brand/` is the source of truth (svg, png, BRAND.md); web icons are in `public/`, replacing the placeholder favicon. Files are used exactly as delivered.
- **Name:** the wordmark artwork reads "Geodex"; text in the app and docs uses "GeoDex", as the author asked earlier. The artwork is not redrawn.
- **Deferred:** the PWA manifest icons from the handoff go in with vite-plugin-pwa in Phase 4. `og:image` uses the absolute workers.dev URL so link previews work. The GitHub social preview is uploaded by the author in repo settings and only shows once the repo is public.

## 021. Placement with one probe right

- **Context:** `PLAN.md` 6.4 covers both probes right and both wrong, not one of each.
- **Decision:** one right probe tests the whole subregion like two right ones, since that is where knowledge is mixed. The subregion is reported as "partial".

## 022. When grading judges speed

- **Decision:** Easy needs 50 reviews in a mode (`PLAN.md` 6.2); Slow (Hard) needs 10, so the first answers are not judged against a median of two or three values.

## 023. Review events are written on continue

- **Context:** the time budget uses prompt-to-continue time, grading uses prompt-to-answer time.
- **Decision:** the event is written when the learner continues, with both `responseMs` (prompt to answer) and a new `durationMs` (prompt to continue). Closing the app during feedback loses that one answer; the event stays a single immutable record.

## 024. Contrast cards and hooks wait for content

- **Decision:** confusions are logged from Phase 2 and curated look-alike pairs (`data/curated/confusion-pairs.json`) already shape distractors. Contrast cards are created and studied once their contrast text exists (Phase 3, `content/confusions.json`). The `N` (not helpful) shortcut is listed in the `?` overlay and starts working with hooks in Phase 3.

## 025. Session details

- **Intro panel:** shown once per country, before its first stage 1 card.
- **Hint (`H`):** typed answers only; it shows the first letter and the letter count and grades the answer Hard.
- **Map answers:** a click or tap submits immediately; there is no confirm step.
- **Feedback zoom:** the map flies to the target with margin, or to the target and the wrong pick together; neighbors are labeled when visible.

## 026. Bundle size

- **Context:** the main chunk is about 710 kB minified (227 kB gzipped), mostly React DOM, React Router, Dexie, i18next and d3. World data loads as separate chunks.
- **Decision:** accepted for Phase 2. Route-level code splitting and precaching come with the PWA work in Phase 4 and the performance pass in Phase 10.

## 027. Placement seeds a review interval of days

- **Context:** the scheduler runs with short-term learning steps, so a correct placement answer (rating Good on a new card) came back due in 10 minutes. After placement, the first daily session was all re-checks of countries the learner had just placed, and no new cards fit the budget. PLAN.md 6.4 asks for a check "within days".
- **Options:** (a) seed placement answers with a scheduler that skips short-term steps, so they enter review with the FSRS first interval for Good (3 days at 0.9 retention); (b) keep learning steps and exclude placement cards from today's due list.
- **Decision:** (a). It is a pure function of the event, so replay stays deterministic, and it does not need special cases in the day plan. Only the first scheduled review of a new card in `placement` mode is affected. Schema v3 rebuilds the card state cache once so existing placements pick it up.

## 028. Motion beyond the answer moment

- **Context:** after the first real session the author found the UI plain and asked for a smoother, more modern feel. PLAN.md 8.2 keeps visual boldness for the answer moment and everything else quiet.
- **Decision:** add quiet motion only: panels fade and rise in (about 400 ms), the map glides between prompts with the same fly-to as answers, progress eases, buttons press. One UI easing for every theme; the map easing stays the only per-theme difference. Reduced motion turns all of it off. The answer moment stays the boldest thing on screen: the target fills in, the wrong pick's outline draws itself, labels fade in as the map settles.

## 029. Explanation content details

- **Fact verification:** a fact is `verified: true` only when it restates committed data (neighbors, coast, official languages). Every other fact starts as `verified: false` and is listed in `content/REVIEW.md` until the author confirms it. Facts avoid hand-written numbers and dates; the linter rejects digits without a `sourceUrl`.
- **Leech moment:** shows every remaining hook (PLAN.md 6.9), so it is exempt from the 60-word cap in 7.4.
- **Hook ids:** `<ISO3>.<locale>.<n>` for hooks and `<ISO3>.cap.<locale>.<n>` for capital hooks; ids never change once shipped, because "Not helpful" votes and snippet ids refer to them.
- **Flag notes** count as tier 1 facts on flag cards. `flag_decode` hooks are never shown on map cards.
- **Snippets shown on the intro panel** are stored with that card's first review event, so they count as seen.

## 030. Sync details

- **`duration_ms` column:** the review event schema in PLAN.md 5.6 has no column for `durationMs` (DECISIONS.md 023), so the migration adds `duration_ms integer`. Without it, a synced device would lose the time-budget input for events from other devices.
- **Fresh settings:** a new device writes default settings with `updatedAt: 0`, so on its first sync the settings from an existing device win by last write wins instead of being overwritten by defaults.
- **Accounts:** the app asks for an email code with `shouldCreateUser: false`, so it can never create an account. The author creates the account in the Supabase dashboard, then disables sign-ups (README).

## 031. Sign in with a pasted link

- **Context:** PLAN.md 5.6 asks for an email code typed into the app. Supabase now lets the Magic Link email template be edited only with custom SMTP, which would add another service, and the default email contains a link, not a code.
- **Options:** (a) require custom SMTP so the email can show `{{ .Token }}`; (b) accept the link itself: the learner pastes it into the app, which reads its token hash and calls `verifyOtp` with it.
- **Decision:** (b), and typed codes still work if a template shows one. Pasting keeps the iOS benefit of codes (sign-in happens inside the home-screen app's own storage) with no extra service. On a laptop, clicking the link signs in directly, since the client picks the session up from the URL.

## 032. Phase 5 progress details

- **Playful mastery ramp:** PLAN.md 8.1 asks for viridis. Viridis starts at saturated yellow, which made every country not yet started the loudest thing on the Atlas and Stats screens. Options: (a) plain viridis for levels 0 to 4; (b) a neutral tint for level 0 (not started is the absence of mastery, not a step on the scale) and viridis for levels 1 to 4. Chose (b); the ramp stays luminance-monotonic and is covered by the contrast test.
- **Card cache self-heal:** the empty-cache check runs once per load. Checking on every update misread the moment between the first review event and its card state (two live queries update one after the other) as a missing cache, and remounted the running session.
- **Region drills:** studied cards first, then location cards for every country in the region fill the drill to 20, so a region with one studied card still gives a real drill.
- **Mastery level of a country for a skill** is the lower level of the skill's two cards, so both directions must be known before a country reads as mastered. A country with either card started is at least "learning": with the plain minimum, placement (which seeds one direction) left every skill map blank.
- **Atlas globe:** sideways drags turn the projection instead of sliding the picture, so the Pacific can sit in the middle. Re-projecting 50m borders takes about 70 ms, too slow per frame, so the globe draws with every sixth vertex while turning (about 16 ms) and at full detail when released. Session maps keep plain pan and zoom so the answer fly-to stays exact.
- **Map taps:** a marker's visible dot wins, then the country shape under the pointer, then the nearest marker tap target. Before this, the 44 px tap targets of small countries covered parts of Norway at world zoom.

## 033. Cities: a short list of world-famous cities

- **Context:** PLAN.md 5.1 asks for about 200 cities (the largest non-capital city per country plus globally known ones). The author narrowed this: only really famous cities.
- **Options:** (a) an automatic rule (Natural Earth's world-city rank), which lets in Ürümqi and Denver and misses Barcelona and Venice; (b) a short hand-picked list in `data/curated/cities.json`, with Wikidata supplying names, coordinates and population.
- **Decision:** (b). 38 cities: world-famous non-capitals plus every city commonly mistaken for its country's capital (Sydney, Istanbul, Toronto...), which the Phase 6 acceptance needs. Aliases are curated too (Bombay, Saigon, Rangoon); Wikidata's alternative labels are mostly nicknames. The data test caps the list at 50.

## 034. Groups of countries

- **Context:** the author asked for questions and map placement about groups of countries such as Scandinavia and the Caribbean, "all you can find". PLAN.md has no such module.
- **Options:** (a) pull every grouping Wikidata knows (hundreds, mostly obscure, membership often wrong or out of date: it lists Australia as an ASEAN member); (b) a hand-picked list in `data/curated/groups.json`, cross-checked against Wikidata once.
- **Decision:** (b), 39 groups: 21 commonly named regions and organizations (Scandinavia, Nordic countries, Baltic states, Benelux, Balkans, Middle East, Horn of Africa, EU, NATO, G7...) and 18 UN subregions with their M49 members. South America, Northern America and Australia and New Zealand are left out: a continent or two countries is not a group worth a card. ASEAN is left out because since Timor-Leste joined it has exactly the members of South-eastern Asia, so a map of it has two right names.
- **Fuzzy groups:** where definitions disagree (Balkans, Middle East, Levant), `members` holds the countries every common definition includes and `sometimes` the rest. A `sometimes` country is never asked and never a wrong answer, and tapping it is neither right nor wrong.
- **Cards:** `group_to_map` (tap every member, for groups of at most 13), `map_to_group` (name the highlighted group) and `group_member` (which of these is in it). A group starts once half its members are introduced, with all its cards together, and draws on the new-card allowance like cities. Tapping members is graded by the count of misses and wrong taps: none is Good, one is Hard, more is Again.

## 035. Landmarks: one country each, photos checked by hand

- **Context:** PLAN.md Phase 7 asks for about 120 landmarks with one Commons photo each under an allowed license.
- **Choices:**
  - A "which country" card needs one answer, so sites on a border (Victoria Falls, Iguazu, Niagara, Everest, the Matterhorn, Lake Titicaca) and the Jerusalem sites are left out. Perito Moreno is kept with Argentina, where the glacier lies; Wikidata lists Chile too because the ice field behind it is shared.
  - Wikidata's photo is replaced in `content/landmarks.seed.json` where its license is not allowed (the only Charles Bridge photo is Free Art License, so the Rialto Bridge took its place) or where it does not show the landmark (a satellite view of the Galápagos, a map of the Atacama). Two landmarks never share a photo (Banff used the Moraine Lake photo, so the Gateway Arch took its place). The moai item has no coordinates, so Easter Island stands in with the Ahu Tongariki photo.
  - Five Commons files have no machine-readable author. Their authors are read from the file pages and kept in the seed's `credit`.
- **Commons rate limits:** the Commons API answers HTTP 429 from shared build machines. `fetch-landmarks.ts` asks for 50 files per request, one request at a time, and backs off on 429; raw answers are cached like every other fetch.

## 036. Physical features: Natural Earth 1:50m, rivers by segment name

- **Context:** PLAN.md Phase 8 asks for about 85 oceans, seas, rivers, ranges, deserts and lakes from Natural Earth.
- **Choices:**
  - 91 features in `data/curated/physical.json` by Wikidata QID: 5 oceans, 20 seas (gulfs and bays included), 25 rivers, 17 mountain ranges, 12 deserts, 12 lakes. The Atacama is left out because it is already a landmark (one QID, one entity).
  - Marine polygons, lakes and geography regions carry a Wikidata id in Natural Earth, so they are matched by it; the north and south halves of the Atlantic and Pacific merge into one ocean each. Natural Earth's rivers have no Wikidata id and are split into segments named locally (Amazonas, Donau, Chang Jiang), so each river lists the segment names that make it up.
  - The build simplifies each shape (tolerance by kind), places the label at the interior point farthest from the edge (on the line for rivers), and records the countries a feature crosses or borders. Those countries decide when its cards start, like cities and landmarks after their country. The Southern Ocean borders no country in scope; oceans start with the first country.
  - The Caspian Sea is a sea here, as Natural Earth's marine layer has it.
  - A new feature card frames the feature itself (its bounding box, widened to at least 24 by 14 degrees), not the countries it touches: a country view left the Sea of Okhotsk half off screen (Russia is too wide to frame) and made Lake Chad too small to tap. The acceptance test taps every feature at this zoom on desktop and phone.

## 037. History outlines: drawn from modern borders and by hand, all dated

- **Context:** PLAN.md Phase 9 names CShapes 2.0 and community historical basemaps as candidate sources for dissolved states and empires, with the instruction that share-alike or GPL data stays out of the main files.
- **Checked:** CShapes 2.0 is CC BY-NC-SA 4.0 (its site, icr.ethz.ch/data/cshapes). The historical-basemaps repository (aourednik) is GPL-3.0 (its LICENSE file). Both would bind the app's data to their terms, and CShapes forbids commercial use.
- **Options:** (a) ship one of them in a separately licensed file; (b) use neither: draw dissolved states as the union of their successors' Natural Earth shapes (public domain), and empires as hand-simplified outlines clipped to land on the map.
- **Decision:** (b). The Soviet Union, Yugoslavia, Czechoslovakia and the United Arab Republic match their successors' borders closely and are not marked approximate. East and West Germany are drawn by hand along the inner German border and clipped to Germany. Austria-Hungary, Gran Colombia and every empire are marked approximate, and each outline shows the year it represents (the empire near its greatest extent, a dissolved state just before it ended). The British, Spanish and Russian empires are unions of the modern countries they mostly held, so they leave out territories they held only in part (the Aden colony, Spanish Louisiana) and include whole countries they held only in part (Poland in the Russian Empire).
- **Borders over time:** with no verified year-by-year dataset, the Atlas explorer shows the outlines whose period contains the chosen year, each labelled with its own snapshot year. It is a view, not a quiz.
- **Ids:** QIDs come from English Wikipedia titles via Wikidata sitelinks. Persia, Burma, Ceylon, Swaziland, Macedonia and Kampuchea are older names of states that still exist (or, for Kampuchea, of two successive regimes), with no Wikidata item of their own; they use `former-<name>` ids and cite the current country's item.
- **Cards:** a former name starts once its current country is introduced; a dissolved state once half its successors are; an empire once a third of the countries it covers are. "Which of these was part of X?" asks only for dissolved states with at least two successors, and never offers a country that was partly inside (`partly`). "When did X exist?" offers only other empires' periods that do not overlap the answer.

## 038. Reset progress without deleting events

- **Context:** the author asked for a "reset progress" button. Review events are append-only and never deleted, locally or remotely (CONTRIBUTING.md invariant 1), and synced devices would bring deleted events back anyway.
- **Options:** (a) delete the events and the card cache, against the invariant; (b) store the reset time in the synced settings and replay only the events after it.
- **Decision:** (b). `progressResetAt` sits in the settings row, so it syncs by last write wins like the rest. Card state is rebuilt from events after that time (invariant 2 still holds: events plus settings), and progress, streak, stats and achievements read the same filtered events. The placement test runs again. Earlier events stay in the log, in exports and on the server.
