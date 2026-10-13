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
