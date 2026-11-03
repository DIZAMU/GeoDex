# GeoDex 2.0 plan

Agreed with the owner in a Q&A on 3 November 2026. This is the build plan for the public 2.0 release. Where it differs from the proposals in `docs/design/UNSLOP.md`, this file wins. Every UI, copy and docs change follows `docs/design/UNSLOP-PLAYBOOK.md`.

## Release rule

- Version 2.0.0.
- Target: public by Friday 6 November 2026. The date is a target, not a deadline: the repo goes public when everything below is done and checked.
- All work happens on a branch with Cloudflare preview links the owner can try on a phone. The live site changes only when 2.0 is released.
- Every screen is revamped before going public. Nothing from the 1.0 look is left mixed in.

## Decisions

### Saving and accounts

| Topic | Decision |
| --- | --- |
| Login | Removed. No accounts, no email, no sign-in anywhere |
| Supabase | Removed from the code. The owner exports their synced progress to a backup file first, then deletes the Supabase project |
| Where progress lives | In the browser on each device (IndexedDB), saved automatically the moment each answer is given. No save button |
| Moving devices | Settings has "Download backup" and "Restore backup". Settings shows when the last backup file was made |
| Backup reminders | None |
| People per device | One learner per browser. Settings has "Start over", which wipes progress after a confirmation |
| Privacy | A new visitor always starts from a blank slate, because nothing is stored anywhere but their own browser |

### Look

| Topic | Decision |
| --- | --- |
| Colour mode | Light by default. Dark mode derived from the same tokens. Choice of Light, Dark or Match device |
| Themes | One system. Atlas, Minimal and Playful are removed; existing users are moved to the new system |
| Palette | "Paper and sea". Ground `#f7fbfc`, ink `#121c23`, muted `#606b72`, accent `#006495`, sea `#cae3ed`, land `#fcfcf9`. Dark: ground `#0c1316`, ink `#e6ecef`, muted `#96a0a6`, accent `#6eacd7` |
| Accent use | Ink blue on the one main action and the next region on the map, nowhere else in the chrome |
| Fonts | Schibsted Grotesk for everything. Newsreader italic only for water and mountain names on the map |
| Accessibility | WCAG 2.2 AA, checked in automated tests |

### Screens and flow

| Topic | Decision |
| --- | --- |
| First visit | A live question on the map comes first, with one short line on what GeoDex is and a "Start learning" button. The spinning globe, nine topic tiles and 1-2-3 steps go |
| Placement test | Dropped. Everyone starts from the beginning. The "Rerun the placement test" setting goes too |
| Language | Follows the browser: Norwegian for Norwegian browsers, English otherwise. Switchable on the first screen and in Settings |
| Phone navigation | A bottom bar: Today, Atlas, Stats, Settings, Help. The floating help button goes |
| Today | Start first: cards due and minutes, length choice, start button, then the map. Level bar plus one line such as "Explorer, 1 240 XP". The full XP breakdown moves to Stats |
| Streak and celebration | Both kept: the streak flame and the celebration on a new rank or level, cleaned up visually and quiet under reduced motion |
| Sound and vibration | On by default, with a setting to turn each off. Sounds are short tones generated in the browser (no audio files): a light chime for right, a low soft tone for wrong, a small flourish at the end of a session. Vibration where the device supports it |
| Install prompt | Never. People who want it installed use the browser menu |

### Tour

| Topic | Decision |
| --- | --- |
| Length | Four to five steps: a centred intro card, the start control, how you answer, your map and level, and a final "Ready?" card |
| Start | Runs once automatically after the first screen and the home country. Skip ends it for good. Help can replay it |
| Motion | The spotlight glides between targets (ease-in-out, about 350 ms); the card fades in and rises a little. Crossfade only under reduced motion |
| Final card | Says what is set up and offers one button that starts the first session, plus a plain link to look around first |

### Going public

| Topic | Decision |
| --- | --- |
| Hosting | Cloudflare free plan, static files only, plus the offline app. No server left to attack once Supabase is gone. No mirror |
| Analytics | None |
| Licence | PolyForm Noncommercial, as today |
| Community | Issues open for bugs and wrong facts. Pull requests from others are not accepted |
| README | Plain rewrite: what GeoDex is in two lines, the link, screenshots, how to run it, licence. No badge wall, no marketing tone |
| Demo video | About one minute, desktop 16:9, English. See the demo section below |

### Quality

| Topic | Decision |
| --- | --- |
| Tests | Unit and end-to-end tests, screenshots at 390, 768 and 1280 px in both languages and both modes, automated accessibility checks. Then the owner tries it on their own phone before going public |
| Content | An automated check of capitals, currencies and languages against the data. Then the owner reads a sample, such as the Nordic countries, for tone |
| Norwegian text | The owner reads every new and changed Norwegian string before release |

## Demo video

- **Length and format:** about one minute, 16:9 desktop, English, MP4.
- **Feel:** cinematic, smooth and animated, like a professional studio edit. Smooth zooms and pans into the part of the screen that matters. Fast cuts in rhythm with the music. Captions as titles that name each step.
- **Footage:** the real app being used, from the first screen to a finished session and the map filling in. Staging is fine: seeded progress, a tidy browser frame, timing stretched to fit the music.
- **Music:** an upbeat track with a free licence (CC0 or equivalent), with its source and licence recorded in the repo.
- **How it is made:** recorded with Playwright in the browser and edited with ffmpeg, both free. If the result needs more polish, the owner may connect extra tools later.
- **Publishing:** the owner uploads the MP4 once through the GitHub README editor, which gives it a playable link. The README text is prepared beforehand.
- **Reference:** the demo in the owner's RootCause repo, for its spirit and not its exact look. That video could not be downloaded in this session, so its details come from the owner's description.

## Work order

Each stage ends with its tests passing and screenshots checked. All of it follows the playbook's method: direction, audit, passes in order, verify.

### 1. Remove login and Supabase

Code changes:

- Delete `src/sync`, the `supabase/` folder, the `@supabase/supabase-js` dependency, the sync settings and any sync environment variables.
- Keep and restyle the backup feature (`src/db/backup.ts`, `BackupSection.tsx`): "Download backup", "Restore backup", the date of the last backup, and "Start over" with a confirmation.
- Move users with the old Atlas, Minimal or Playful setting to the new system without losing progress.
- Tests: backup round trip, Start over, no network requests to any backend, and a fresh visitor sees a blank slate.

Owner actions:

- Before release, export your synced progress from the live site.
- After release, delete the Supabase project and remove its keys from Cloudflare.

### 2. The design system

- One token set for light and dark, with computed contrast checks in `contrast.test.ts`.
- Schibsted Grotesk and Newsreader (map labels only).
- A fixed type scale, a 4 px spacing grid, one small radius, and one easing curve.
- Lucide icons at one size and stroke. Decorative AI glyphs and arrows on buttons are removed; the streak flame stays.
- Motion by frequency, as set out in the playbook.
- Sound and vibration module with its two settings.

### 3. Screens

In this order, each one checked against the playbook before moving on:

1. First screen with the live question.
2. Home country and language.
3. Today.
4. Session and feedback.
5. Session summary.
6. Atlas and country pages.
7. Stats, with the XP breakdown.
8. Settings.
9. Help.
10. Bottom navigation.

### 4. Tour

The new four or five step tour, with stable anchors. Tested with the keyboard alone, with a screen reader, at 200 percent zoom and with reduced motion.

### 5. Content and Norwegian

Owner actions are marked "owner".

- The automated fact check script for capitals, currencies and languages.
- The owner's spot read of a sample of countries (owner).
- The list of every new and changed Norwegian string for the owner to read (owner).

### 6. Full test pass

- The whole unit and end-to-end suite.
- The screenshot matrix: three widths, two languages, two modes.
- Automated accessibility checks on every screen (axe).
- A click-through of every control.
- The owner's own phone check on the preview link (owner).

### 7. Going public

Done by the assistant:

- README rewrite with screenshots.
- The demo video and its music credit.
- `CONTRIBUTING.md` updated to say issues are welcome and pull requests are not accepted.
- Release notes for 2.0.0, and the release.

Owner actions:

- Upload the video.
- Merge.
- Make the repo public.

## Notes and risks

- **Vibration:** iPhones do not support web vibration, so the vibration setting only does something on Android. Sounds work on both, after the first tap.
- **Losing progress:** clearing browser data erases progress. The backup buttons are the only safeguard, by choice. Say so plainly in Settings and Help.
- **Old placement data:** existing users who took the placement test keep their progress. Only the test itself goes.
- **Music licence:** the track's licence is checked and recorded before the video is published.
- **Cloudflare previews:** preview links depend on the Cloudflare integration already used by the repo's pull requests.
