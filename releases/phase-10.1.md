# Phase 10.1: reset progress and accessibility

Start over from Settings, and answer every card without the map.

Features
- Reset progress in Settings, behind a confirm step: progress, streak and stats count only reviews from then on, and the placement test runs again. No review is deleted: earlier ones stay in exports and synced history, and the reset syncs to your other devices
- Answer from a list: map, pin, feature and tap cards can be answered by filtering names and picking one, by keyboard or screen reader
- Scrollable regions on Stats and the Atlas timeline take keyboard focus
- "Report a wrong fact" opens a prefilled GitHub issue; it stays hidden while the repository is private

Quality
- An accessibility check (axe) on every main screen in every theme finds no serious violations
- CI fails if unit tests cover less than 90% of the engine's lines (now 97%)
