# Unslop findings for the GeoDex revamp

Research from 2 November 2026: 15 minutes on what reads as generated design and copy, then about 15 minutes on the anti-slop skills people publish. Thirteen of those repositories were downloaded and their rule files read. The raw notes run to about 600 lines in the session scratchpad (`unslop/notes-slop.md` and `unslop/notes-unslop-repos.md`), which disappears when the session ends. This file keeps what we act on.

Nothing here is decided yet. The direction and every "our call" below go into the Q&A before we build.

## The idea the sources share

Slop is a default nobody chose: the purple gradient that appears when no one asked what the product is made of. The repos that hold up all arrive at the same order:

1. Write the direction from the subject before touching a pixel.
2. Keep the chrome quiet and give the colour to one or two moments of content.
3. Check the rendered screen, at phone and desktop width, against a list of known tells.

Removing tells without step 1 produces what one repo calls "an empty page with good manners". Swapping purple for teal only moves the default somewhere else.

## Sources

| Repo | What it does | What we take |
| --- | --- | --- |
| [heydamir/unslop](https://github.com/heydamir/unslop) (Damir Sokolovsky, CC BY 4.0) | Nine ordered passes on an existing UI: spacing, colour, icons, copy, type, layout, details, visuals, motion | The pass order, the five line direction, its token values as a starting point, the template check |
| [nishchay-bhudia/unslop](https://github.com/nishchay-bhudia/unslop) | Rewrites AI-sounding social posts; 23 point writing checklist | Never invent a fact; ask for the real detail; say so when a text is already fine |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | Dated registry of tells in three waves, plus a study of 247 real sites and 23 app screens | The app screen rules, the "fix that became the look" warning, the colour proportions |
| [Nutlope/hallmark](https://github.com/Nutlope/hallmark) | About 85 numbered gates in tiers: Floor (never), Reflex (needs a reason), Finish | Eyebrow, tracked caps, middle dot strings and fake success as hard bans; app screen scope |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Deterministic detector (side stripe, gradient text, glow, nested cards, stock swatches) plus commands like audit and quieter | "Operate and read" mode: the tool should disappear into the task |
| [funboy322/avoid-ai-design](https://github.com/funboy322/avoid-ai-design) | 67 tell catalogue and a DESIGN.md template | The silhouette and squint tests; a refused defaults list in the design file |
| [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop) | Rules R-01 to R-40 in three tiers and a delivery gate | No dead controls; a recorded click through; a one line reason per decision; fixed dark mode needs a reason |
| [Vinayak-Shukla-03/anti-ai-slop](https://github.com/Vinayak-Shukla-03/anti-ai-slop) | Nine hard rules and a 12 box self audit | "Could these tokens be pasted onto another product unchanged?" |
| [ibelick/ui-skills](https://github.com/ibelick/ui-skills) baseline-ui | Short MUST and NEVER list for UI code | Interaction feedback under 200 ms; empty states get one next action |
| [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) | Review rules for accessibility, forms, motion, i18n | URL reflects state; Intl for numbers and dates; interruptible animation |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | Animation decision framework | Animate by frequency: frequent means instant, rare means delight |
| [blader/humanizer](https://github.com/blader/humanizer), [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop), [theclaymethod/unslop](https://github.com/theclaymethod/unslop) | Writing tells: 26 patterns, 8 rules, 36 phrase families and scanners | Copy rules below; clusters matter more than one hit |
| Tour guides (usertour, ezud) | Product tour practice and accessibility | Action early, skippable, Escape closes, end on the next real action |

Also read during the first 15 minutes: AdrianKrebs/design-slop-cop (15 patterns with how often each shows up), gabelul/pixelslop, Laith0003/ux-skill and its ban list with exact values, wpgaurav/design-slop, hegemonarch/get-design-done, the official frontend-design skill, Wikipedia's "Signs of AI writing", tropes.fyi (49 writing tropes) and the Superdesign prompt study (requests for dark mode rose from 27 to 38 percent between January and May 2026).

## Tells, and where GeoDex has them

Each tell below comes from the catalogues above. The middle column is evidence from our code and the live site.

### Colour and surface

| Tell | GeoDex today | Fix |
| --- | --- | --- |
| Violet or indigo as the accent | Playful theme primary `#6c4ab6` with a violet shadow | Remove |
| Coloured glow and colour washes | Atlas `--glow` amber and blue washes | Remove; depth from a lighter surface step |
| Dark navy as the default look | Atlas theme `#0e2433` is the default | Light by default, dark as an equal second mode |
| Border and shadow on the same card | Minimal and Atlas cards carry both | One or the other, never both |
| Accent on chrome | The accent (amber in Atlas) fills the help bubble, both rings, selected pills and the focus ring | Accent on the one action and one data point per screen |
| Bounce easing | Playful `--ease-map` overshoots | One curve for everything |
| Three themes as costumes | Atlas, Minimal, Playful drift by design | One system with light, dark and match device |

### Type

| Tell | GeoDex today | Fix |
| --- | --- | --- |
| Tiny tracked capitals as labels | `AtlasScreen.tsx:203` continent headers | Sentence case, normal tracking |
| Text under 11 px | Goal ring caption at `text-[0.65rem]` (10.4 px) | 12 px floor for labels, 13 px for captions |
| Middle dot meta strings | Rank and XP line on Today | Two lines or two columns |
| Serif display as a premium shortcut | Newsreader on names and titles | A serif only where cartography earns it (see below) |

Our fonts can stay. Schibsted Grotesk is on no banned or saturated list in any repo, and it comes from a Norwegian media house, which suits an app written in Norwegian first. Newsreader appears on those lists only as a body serif.

### Layout and components

| Tell | GeoDex today | Fix |
| --- | --- | --- |
| Pill badge above the hero | "Free geography trainer" on Welcome | Fold it into the lead sentence |
| Icon tile grids | Nine topic tiles on Welcome | A list with counts, set in type |
| Numbered 1, 2, 3 how it works cards | Welcome steps | Show the real thing instead: the map and one live question |
| Stock section order | Hero, topics, benefits, how it works, time | Order by the argument: what you learn, how long it takes, start |
| Floating round help button | `AppLayout.tsx:84`, accent filled, bottom right on every screen | Help as a plain item in the navigation |
| Hover lift on cards | `HelpScreen.tsx:149`, `parts.tsx:173` and `:208` | Colour or surface step on hover; small scale on press only |
| Segmented On and Off pills for booleans | Topic toggles in `SettingsScreen.tsx:158` and `:168` | A real switch |
| Desktop layout squeezed onto a phone | Welcome is 5743 px tall at 390 px wide | A phone layout of its own |
| Motion that starts by itself with no pause control | The Welcome globe spins continuously (`GlobeMap.tsx:476`). It does stop while dragged and under reduced motion, but WCAG 2.2.2 also asks for a way to pause anything moving past 5 seconds | Static map, or rotation only on drag |

### Icons

Lucide stays, since it is the set we already use. Sparkles goes: the catalogues name it as the stock AI glyph. Brain, Flame and Award go with it, since they decorate rather than explain. Arrows come off button labels. One size (18 px), one stroke (1.5), colour from the text role.

### Copy

| Tell | GeoDex today |
| --- | --- |
| A triad of negatives | "Free. No ads, no account, no tracking." |
| A quotable slogan as the headline | "Learn the world, and keep it." |
| Headings that start with What, How or Why | "What you can learn", "What you get", "How it works", "Why cards come back" |
| A dramatic closer | "Cramming fades within days. ... A year from now, you still ..." |
| Touring the navigation | Tour steps for Atlas, Stats, Settings, Help |

Most of our copy is good. "You never grade yourself. Wrong is wrong." and the time estimate built from your own settings are the kind of specific lines the writing guides ask for. The content linter and VOICE.md already ban the travel guide adjectives.

## Disagreements between the skills, and our call

| Question | The split | Our call (to confirm) |
| --- | --- | --- |
| Hairline borders | heydamir uses 6 to 10 percent hairlines; taste-skill bans thin rules on pages but allows them in apps | Allowed: GeoDex is an app, and a graticule line is native to a map |
| Italic and spaced capitals | Banned in UI by most repos | Banned in the chrome. On the map, water names in blue italic and spaced capitals for oceans and continents are centuries of map making, so they stay there |
| Card radius | 12 to 16 px versus "square or round, chosen once" | One small radius (6 to 8 px) for controls and cards; fully round only for switches and status dots |
| Title Case | Vercel's guide asks for it; the slop catalogues ban it | Sentence case. Norwegian has no Title Case anyway |
| Curly quotes | Typography guides want them; one writing skill calls them a weak tell | Curly in English, «» in Norwegian, never straight quotes in UI |
| Custom easing curves | One repo says never; another says built ins are too weak | One custom curve, already in our code: `cubic-bezier(0.22, 1, 0.36, 1)` |
| Dashes | Typography guides want en dashes for ranges | Our repo rule wins: no em or en dashes; ranges use "to" |

## Direction draft

Five lines, written the way heydamir/unslop asks. It is a draft for the Q&A.

- Product: a geography trainer that schedules every country, capital and flag so you remember them for years.
- Character: exact, calm, a little dry. (Clean, modern, sleek, minimal and premium are banned words here.)
- World: a printed school atlas and a wall map in daylight. Paper, ink, sea blue, land in pale tints.
- Moments: the map in every question, and the flags. They are the only places with full colour.
- Signature: the graticule. Thin latitude and longitude lines, only on the map, at the one line weight that progress bars also use.

Template check: swap "GeoDex" for "Duolingo" or "Anki". If the screen still fits, the direction failed.

## Taken into the revamp

### Colour

- One neutral ramp tinted slightly toward sea blue, three text roles (primary, secondary, muted), one accent.
- The accent covers under 5 percent of any screen: the primary action, the selected answer, one key figure.
- Correct and wrong use toned green and red, always paired with an icon or a word, never colour alone.
- Light by default. Dark is re-derived from the same tokens with the hue held fixed and surfaces lighter as they rise. Dark has no shadows.
- No gradients except one tone step inside a neutral. No glows.

### Type

- Schibsted Grotesk for the interface. Newsreader only for physical features on the map, or dropped. That is a Q&A question.
- Fixed scale at about 1.2: 12, 14, 16, 20, 24, 32. Five sizes in use on any one screen at most.
- Weights 400 and 500, 600 only for the one figure that matters. Tabular figures for every number.

### Layout

- Each screen answers one question with its biggest block. Today: start the session. Session: the question and the map. Atlas: the map.
- Phone first. Bottom navigation with four or five short labels, thumb reach answers, 44 px targets, nothing under 12 px.
- Settings as a list of rows with real switches, each change saved on the spot with a quiet "Saved", and the effect shown next to the control ("12 new cards a day, all countries in about 9 weeks").

### Motion

| How often it happens | Motion |
| --- | --- |
| Every answer (tens of times a day) | Near instant: a 120 ms colour change, a press at scale 0.97 |
| Opening the picker, a sheet, a dialog | 160 to 250 ms, ease out, exit faster than entry |
| The tour, a level up, the end of a session | Room for delight, 300 to 450 ms |
| Reduced motion | Same state changes, no movement, crossfade only |

### Copy

- Say what the thing does in the subject's own nouns. No eyebrows, no Wh headings, no slogans, no exclamation marks.
- No trailing period on headings, labels and buttons. Paragraphs keep them.
- Buttons name the action: "Start 10 questions" instead of "Get started".
- Never invent a number. Every figure on screen comes from the data or the user's settings.
- Run every new string past the cluster test: two or more tells in one paragraph means rewrite.

Questions to ask of every new string, in English and Norwegian:

- Could this sentence sit unchanged in another app's help? Then it says nothing about GeoDex.
- Does it repeat the setting's name or what the screen already shows? Cut it.
- Does it justify ("lets you", "helps you") instead of telling? Say what happens.
- Is there a "not X, but Y", a row of three, a fragment for drama, or a closer that sums up? Rewrite.
- Words to drop on sight: seamless, unlock, effortless, powerful, journey, dive into, rich, nestled, in the heart of, serves as, boasts.
- Norwegian: «» for quotes, sentence case, numbers through `Intl` (Norwegian writes 1 240), and the same plain register as the English.

### The tour

- Four or five steps. Step one is a centred card with no target. One step asks for a real action (pick a session length).
- The spotlight glides between targets with ease in out at about 350 ms. The card fades and rises 8 px with its transform origin toward the target.
- "2 of 5" in small secondary text, then Back, Next and Skip. Escape skips. Focus moves into the card and the page behind is inert.
- The last card asks "Ready?", says what is set up ("10 questions, Europe first, answers on the map") and offers one button: "Start the first session". A plain text link offers "Look around first".

### Screen by screen

| Screen | Its one question | Biggest block | Goes away |
| --- | --- | --- | --- |
| Welcome | What is this and is it worth ten minutes? | A live map with one question you can answer right there | Badge, nine icon tiles, numbered steps, spinning globe, the reassurance band |
| Today | What do I do now? | The start button with the number of cards and minutes | Four boxed cards; both rings (the level becomes a bar, the goal a line of text) |
| Session | Where is it? | The map and the answers | Anything that moves while you think |
| Summary | How did that go? | Right and wrong counts, the cards that slipped | Confetti beyond one short moment on a new rank |
| Atlas | What do I know where? | The map coloured by level | Tracked caps headers, boxes around lists |
| Stats | What am I forgetting? | The forecast and the mix ups, as a list | Charts that only decorate |
| Settings | What changes if I touch this? | Rows with switches and the effect next to them | Stacked identical cards, On and Off pills |
| Help | How does grading work? | Plain sections in one column | Icon cards with hover lift |

## Examples, before and after

### Welcome copy

Before:

> Free geography trainer
>
> Learn the world, and keep it.
>
> Free. No ads, no account, no tracking.

After:

> GeoDex
>
> Every country, capital and flag, learned for good
>
> About 10 minutes a day. Free, and it works offline.

The badge is gone and the slogan is now a plain statement of what you get. The three negatives shrink to two facts.

### Headings and titles

| Before | After |
| --- | --- |
| What you can learn | Topics |
| How long it takes | 10 minutes a day: every country in about 9 weeks |
| How answers are graded | Grading |
| Help is always here | Help |

### Tokens

```css
:root {
  /* Light: paper and ink, tinted toward sea blue */
  --ground: oklch(98.5% 0.004 230);
  --surface: oklch(96% 0.006 230);
  --raised: oklch(93.5% 0.008 230);
  --ink: oklch(22% 0.02 240);
  --ink-2: oklch(42% 0.02 240);
  --muted: oklch(52% 0.018 240);
  --rule: oklch(22% 0.02 240 / 0.1);
  --accent: oklch(48% 0.11 240);      /* one job: the primary action */
  --accent-ink: oklch(98.5% 0.004 230);
  --right: oklch(52% 0.12 150);
  --wrong: oklch(52% 0.16 27);
  --sea: oklch(90% 0.03 225);         /* map only */
  --land: oklch(99% 0.003 90);        /* map only */
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}
```

These values are a sketch. In hex they come out as ground `#f7fbfc`, ink `#121c23`, muted `#606b72`, accent `#006495`, right `#287c42`, wrong `#b33832`, sea `#cae3ed`. Contrast, computed: ink on ground 16.6:1, muted on ground 5.3:1, muted on raised 4.5:1, text on the accent 6.2:1, right 5.0:1, wrong 5.7:1. All pass AA; they still go through `contrast.test.ts` before anything ships.

The dark mode comes from the same recipe: same hues, ground and ink swapped in lightness, surfaces lighter as they rise, the accent lighter and a little less saturated so it does not glare.

```css
[data-mode="dark"] {
  --ground: oklch(18% 0.012 230);     /* #0c1316 */
  --surface: oklch(21.5% 0.013 230);  /* #131b1e */
  --raised: oklch(25% 0.014 230);     /* #1b2327 */
  --ink: oklch(94% 0.008 230);        /* #e6ecef */
  --muted: oklch(70% 0.014 230);      /* #96a0a6 */
  --accent: oklch(72% 0.09 240);      /* #6eacd7, text on it uses --ground */
  --right: oklch(74% 0.12 150);
  --wrong: oklch(70% 0.13 27);
  --sea: oklch(26% 0.03 230);
  --land: oklch(33% 0.012 90);
}
```

Computed: ink on ground 15.8:1, muted on ground 7.1:1, muted on raised 6.0:1, ground on the accent 7.7:1, right 8.5:1, wrong 6.7:1. No shadows in dark; a card is one step lighter than the ground it sits on.

### Today on a phone (390 px)

Before: a stat card, a picker card, an overview card with two rings, a map card, all the same box with the same shadow. After: one column, no boxes, the action first.

```text
+----------------------------------+
| GeoDex                 Mon 2 Nov |
|                                  |
| 24 cards due                     |
| about 8 minutes                  |
|                                  |
| [ 5 ] [ 10 ] [ 20 ]   Mixed  v   |
| [ Start 10 questions           ] |
|                                  |
|  ~~~~~ world map, full width ~~~ |
|  ~~~ next region outlined ~~~~~~ |
|                                  |
| Level 4      12 cards to level 5 |
| ======-----------  Explorer      |
| Goal  6 of 10 min                |
|----------------------------------|
| Today  Atlas  Stats  Settings  ? |
+----------------------------------+
```

The level ring becomes one bar; the goal becomes one line of text. The map is the only colour on screen apart from the start button.

### A question on a phone

```text
+----------------------------------+
| x                      3 of 10   |
| Which country is outlined?       |
|                                  |
|  ~~~~~~~~ map, zoomed in ~~~~~~~ |
|  ~~~~~~~~ target in ink ~~~~~~~~ |
|                                  |
| [ Slovenia    ] [ Croatia     ]  |
| [ Slovakia    ] [ Austria     ]  |
+----------------------------------+
```

Answers sit in the bottom half, in reach of a thumb. After an answer the chosen button turns green or red with a word ("Right", "It was Slovenia"), and the explanation slides up as a sheet.

### Tour card

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body"
  className="tour-card">
  <p className="text-sm text-muted">2 of 5</p>
  <h2 id="tour-title">Pick a session length</h2>
  <p id="tour-body">Try 5 questions now. You can change this before every session.</p>
  <div><button>Back</button> <button>Next</button> <button>Skip tour</button></div>
</div>
```

```css
.tour-spot { transition: clip-path 350ms cubic-bezier(0.77, 0, 0.175, 1); }
.tour-card { transition: opacity 200ms var(--ease), transform 200ms var(--ease); }
.tour-card[data-entering] { opacity: 0; transform: translateY(8px) scale(0.98); }
@media (prefers-reduced-motion: reduce) {
  .tour-spot, .tour-card { transition: opacity 150ms linear; }
  .tour-card[data-entering] { transform: none; }
}
```

### Overview meta line

Before: `Navigator · Level 9   1 240 XP`
After: rank on one line, "Level 9, 1 240 XP" on the next, both in secondary ink.

### Switch instead of On and Off pills

```tsx
<button role="switch" aria-checked={on} onClick={toggle}
  className="group h-5 w-8 rounded-full bg-raised aria-checked:bg-ink transition-colors duration-150">
  <span className="block size-4 translate-x-0.5 rounded-full bg-ground transition-transform duration-150 ease-(--ease) group-aria-checked:translate-x-3.5" />
</button>
```

The "on" colour is ink, so the accent keeps its one job.

### A settings row

Before: a card titled "What you want to learn", then "Landmarks (after their country)" with two pills, On and Off.

After:

```text
Topics
----------------------------------------------------------
Landmarks                                          [  o]
After their country. Adds 120 cards.
----------------------------------------------------------
Physical geography                                 [o  ]
After a country it touches. Adds 96 cards.
----------------------------------------------------------
Daily time                                   10 min   v
12 new cards a day. Every topic on: about 7 months.
```

Each row says what it changes, in numbers computed from the data. The card counts here are placeholders; the real ones come from `courseCards`.

## Questions this raises for the Q&A

- Light by default with a dark mode, or keep a dark default? If dark stays the default, what about the product earns it?
- One design system with light, dark and match device, or keep the three named themes?
- Newsreader: keep it for physical features on the map, or drop it and run one family?
- Welcome: a live question on the map as the first thing a visitor sees, or a static map with one line?
- Navigation on phones: bottom bar, or keep the current layout?
- XP and ranks: keep them visible on Today, or move them to Stats and keep Today to the next action?
- The streak flame and the level up celebration: keep, tone down, or drop?
- The accent: which colour, given the world is paper and sea? Ink blue, a deep green, or something from a printed atlas?

## Order of work

Taken from heydamir/unslop, because spacing changes how everything else reads and copy decides how big a headline needs to be:

1. Spacing on a 4 px grid, with smaller gaps inside a group than between groups.
2. Colour: the token set above, accent pulled off the chrome.
3. Icons: one set, one size, one stroke.
4. Copy, in both languages.
5. Type: sizes and weights after the copy is final.
6. Layout per screen, phone first.
7. Details: radius, focus rings, states for loading, empty and error.
8. Visuals: the map treatment and the flags.
9. Motion, last, by frequency.

Screenshots after each pass, compared against the tell list.

## Worklist from the code

- `src/themes/themes.css`: replace three themes with one token set and a dark mode.
- `src/app/AppLayout.tsx:84`: remove the floating help button.
- `src/features/atlas/AtlasScreen.tsx:203`: sentence case headers.
- `src/features/help/HelpScreen.tsx:149`, `src/features/session/parts.tsx:173` and `:208`: remove hover lift.
- `src/features/today/Overview.tsx`: split the middle dot line; raise the 10.4 px caption.
- Welcome: rebuild around one live map and one question; drop the badge, tiles, numbered steps and globe spin.
- Icons: remove Sparkles, Brain, Flame and Award; strip arrows from buttons.

## Done means

- Screenshots at 390, 768 and 1440 px in both modes, each one opened and looked at.
- The whole app usable by keyboard alone, and the tour usable with a screen reader and at 200 percent zoom.
- Every button does something real; a click through list recorded in the e2e run.
- The squint test: two or three masses per screen, one of them clearly first.
- Both languages on every screenshot. Norwegian runs longer, and no button label or navigation item may wrap at 320 px.
- The template check above, on every screen.
