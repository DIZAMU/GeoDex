# Phase 10.2: faster load, README and architecture

Documentation for the portfolio release, a faster first load, and a tidier timeline.

Changes
- The world data loads as JSON files instead of JavaScript modules: less blocking on phones, and the service worker caches them for offline use
- The borders-over-time view fits its column on laptops, and outlines are easier to see on dark themes
- New README: what GeoDex does, how the memory engine works (FSRS, automatic grading, recall escalation, confusion tracking, hook effectiveness, placement), a demo GIF, screenshots in every theme, an architecture diagram, and self-hosting with or without Supabase
- New docs/ARCHITECTURE.md: event-sourced local-first sync, determinism, the data pipeline, the explanation engine and the trade-offs
- In-browser FSRS parameter optimization is left out for v1: the available optimizer needs cross-origin isolation, which would block landmark photos in Safari (DECISIONS.md 039)

Lighthouse (production build): desktop performance 89, accessibility 100, best practices 100, SEO 92; mobile performance 64.
