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
