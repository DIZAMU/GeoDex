# Phase 5.1: map taps, spinning globe, test sweep

Fixes from reviewing Phase 5, and bugs found by a new exploratory test sweep.

Atlas
- Drag the globe sideways to turn it a full 360 degrees, so the Pacific can sit in the middle
- Markers for small countries show their mastery level
- Skill tabs show progress as soon as either direction of a skill is started

Releases
- A GitHub Release is published automatically when a phase tag is pushed

Fixes
- Clicking a country opens that country: small countries' tap targets no longer cover large neighbors such as Norway
- Stats skill grid is colored by mastered share only; started counts are in the tooltip
- Escape closes the shortcut overlay without ending the session
- The map resizes with the window instead of leaving sideways scroll
- Unknown addresses go to Today, and errors show a themed screen in both languages

Tests: 519 unit, 38 end-to-end. Includes a sweep of every route in both languages, odd URLs, resizing, keyboard and history that fails on any console error.
