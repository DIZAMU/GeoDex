# GeoDex

Spaced-repetition geography trainer. Local-first PWA, English and Norwegian.

> Status: Phase 0 (scaffold). The learning engine, data and content arrive in later phases. See `PLAN.md`.

## Features (planned)

- Countries (location, name, capital, flag, currency, language), major cities, landmarks, physical geography and a history layer.
- FSRS scheduling with automatic grading from correctness and response time.
- Map-based recall on an Equal Earth projection, so sizes are not distorted the way Mercator distorts them.
- Explanations chosen per answer from static, reviewed content: hooks, facts and comparisons with your home country.
- Works offline. Optional sync between laptop and phone through Supabase.
- Full English and Norwegian (Bokmål) interface and content.
- Three themes: Atlas (dark), Minimal (light), Playful.

## Development

Requires Node 24 (`.nvmrc`) and pnpm 10.

```
pnpm install
pnpm dev          # dev server
pnpm build        # typecheck and production build
pnpm test         # unit tests (Vitest)
pnpm test:e2e     # end-to-end tests (Playwright, 1440x900 and 390x844)
pnpm lint         # Biome and the no-dash check
pnpm typecheck
```

## Deployment

Cloudflare Pages, connected to this repository in the Cloudflare dashboard:

- Build command: `pnpm build`
- Output directory: `dist`
- Environment variable: `NODE_VERSION=24`

No config file is needed. Pages serves `index.html` for unknown paths when the build has no `404.html`, which client-side routing relies on.

## License

PolyForm Noncommercial 1.0.0. Free for personal and noncommercial use, with credit to DIZAMU. Commercial use is not permitted. This is source-available, not OSI open source. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.

Author: DIZAMU.
