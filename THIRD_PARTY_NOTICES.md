# Third-party notices

GeoDex is licensed under PolyForm Noncommercial 1.0.0 (see `LICENSE`). It includes or will include the third-party material below, each under its own license.

## Fonts (shipped)

| Font | Package | License | Copyright |
|---|---|---|---|
| Schibsted Grotesk | `@fontsource-variable/schibsted-grotesk` | SIL Open Font License 1.1 | Copyright 2023 The Schibsted-Grotesk Project Authors (https://github.com/schibsted/schibsted-grotesk) |
| Newsreader | `@fontsource-variable/newsreader` | SIL Open Font License 1.1 | Copyright 2020 The Newsreader Project Authors (http://github.com/productiontype/Newsreader) |

The full license texts ship with the app in `public/licenses/`.

## JavaScript and CSS bundled into the app (shipped)

| Package | License |
|---|---|
| react, react-dom, scheduler | MIT, Copyright (c) Meta Platforms, Inc. and affiliates |
| react-router | MIT, Copyright (c) React Training LLC 2015-2019, Copyright (c) Remix Software Inc. 2020-2021, Copyright (c) Shopify Inc. 2022-2023 |
| i18next | MIT, Copyright (c) 2011-present i18next |
| react-i18next | MIT, Copyright (c) 2015-present i18next |
| dexie, dexie-react-hooks | Apache License 2.0, Copyright (c) 2014-2017 David Fahlander (NOTICE below) |
| radix-ui and its `@radix-ui/*` packages | MIT, Copyright (c) 2022 WorkOS |
| @floating-ui/* | MIT, Copyright (c) 2021-present Floating UI contributors |
| class-variance-authority | Apache License 2.0, by Joe Bell |
| clsx | MIT, Copyright (c) Luke Edwards |
| tailwind-merge | MIT, Copyright (c) 2021 Dany Castillo |
| tailwindcss (generated CSS, including Preflight) | MIT, Copyright (c) Tailwind Labs, Inc. |
| tw-animate-css | MIT, Copyright (c) 2025 Wombosvideo |
| aria-hidden, react-remove-scroll, react-remove-scroll-bar, react-style-singleton, use-callback-ref, use-sidecar, get-nonce | MIT, Copyright (c) Anton Korzunov |
| detect-node-es | MIT, Copyright (c) 2017 Ilya Kantor |
| use-sync-external-store | MIT, Copyright (c) Meta Platforms, Inc. and affiliates |
| html-parse-stringify | MIT, Copyright (c) 2025 Henrik Joreteg, Copyright (c) 2026-present i18next |
| cookie-es | MIT, Copyright (c) Pooya Parsa, Copyright (c) 2012-2014 Roman Shtylman, Copyright (c) 2015 Douglas Christopher Wilson |
| tslib | 0BSD, Copyright (c) Microsoft Corporation |

Each package's full license text is in its published npm package. Generating a bundled license file at build time is a Phase 10 task. UI components in `src/ui/` were generated with shadcn/ui (MIT, Copyright (c) 2023 shadcn) and modified.

### Dexie.js NOTICE

```
Dexie.js

Copyright (c) 2014-2017 David Fahlander

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## Data (added in later phases)

These sources are planned and will be listed here with exact versions when they enter the repository:

- Natural Earth: public domain.
- world-atlas (TopoJSON build of Natural Earth): ISC.
- flag-icons (lipis): MIT.
- Wikidata: CC0.
- Wikimedia Commons images (landmarks): per-image license, with author, license and URL stored and shown on each card. Only public domain, CC0, CC BY and CC BY-SA are accepted.
- Historical border datasets: license to be verified before use (see `DECISIONS.md`).

GeoDex does not use mledoze/countries or datasets derived from it (ODbL share-alike).
