# Phase 5.1: map taps, spinning globe, test sweep

Fixes from reviewing Phase 5, and bugs found by a new exploratory test sweep.

Fixed
- Clicking a country on the Atlas opens that country. Small countries' tap targets no longer cover large neighbors such as Norway.
- Atlas skill tabs show progress as soon as either direction of a skill is started.
- The skill grid in Stats is colored by mastered share only; started counts are in the tooltip.
- Escape closes the shortcut overlay without ending the session.
- The map resizes with the window instead of leaving sideways scroll.
- Unknown addresses go to Today, and errors show a themed screen in both languages.

New
- Drag the Atlas globe sideways to turn it a full 360 degrees, so the Pacific can sit in the middle. Markers show mastery levels.
- Releases are published automatically when a phase tag is pushed.

Tests: 519 unit, 38 end-to-end, including a sweep of every route, odd URLs, resizing, keyboard and history.
