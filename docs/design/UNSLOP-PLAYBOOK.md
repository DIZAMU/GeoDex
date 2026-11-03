# Unslop playbook

This file replaces the research done on 2 November 2026: about 30 minutes of reading on what makes design and copy look generated and on the skills built to fix it, 13 of those skill repositories downloaded and read, an audit of GeoDex, a findings file and a page of examples. Read it before any work on GeoDex's interface, copy or docs. Do not redo the research unless asked; everything needed is here.

Companion files in this folder:

- `UNSLOP.md`: the GeoDex audit, with file and line for each problem, and the before and after examples.
- `examples.html`: five screens, five palettes, five type setups, five text treatments and five decisions, drawn with real map data. Open it in a browser.

To start a new chat on this, paste:

> Read docs/design/UNSLOP-PLAYBOOK.md and docs/design/UNSLOP.md first. Follow the playbook's method and rules for every change to UI, copy or docs. Nothing in the GeoDex direction is decided until the Q&A.

## The owner's aim

The owner wants GeoDex to look and read like a person made it on purpose: no "AI slop" anywhere. That covers the interface, fonts, colours, placement, pixel values, boxes and how they sit, the words, and sentence structure. It applies to the app, the README, release notes, commit messages and any document in the repo.

Two things matter as much as removing tells:

1. **Nothing generic in its place.** A page with every tell removed and no idea behind it is still slop (the "avoidance aesthetic"). Each screen needs a reason to look the way it does, taken from geography and maps.
2. **Accessible and calm.** It is a study tool used daily, mostly on a phone. Neat, legible, keyboard and screen reader friendly, and quiet enough to think in.

Standing rules that apply to all work in this repo:

- No em dashes or en dashes in any committed text. Use a full stop, comma, colon or "to" for ranges. Do not swap in parentheses or double hyphens either.
- No mention of the AI assistant or its maker anywhere: files, commits, branch names, PR bodies, release notes, comments.
- Commits are authored as DIZAMU (`117295462+DIZAMU@users.noreply.github.com`), with no co-author or session trailers. Branch names are neutral (for example `design/...`, `feat/...`).
- No paid services or dependencies, and no LLM calls from app code or scripts.
- Every UI string goes through i18n in both English and Norwegian (bokmål).
- Show screenshots and check them before calling UI work done.

## Slop, defined

Slop is a default nobody chose. The purple gradient, the three icon cards, the "Unlock your potential" headline: each was once a good idea somewhere, and became a tell by appearing everywhere without a reason.

It comes in waves, and each fix becomes the next tell:

| Wave | Looks like |
| --- | --- |
| First (2023 to 2024) | Violet and indigo gradients, gradient text, glowing buttons, glass cards, three identical feature cards with an icon in a rounded square, emoji as icons, a soft grey shadow under every card, Inter everywhere |
| Second (2025) | A tiny tracked capitals label above every heading, a pill badge above the hero ("New", "Beta"), one word of the headline in italic serif or colour, bento grids, near-black with one neon accent, floating blurred pill navigation, a pulsing "live" dot, fade and rise on every section |
| Third (2025 to 2026), the fix that became the look | Cream paper with a terracotta or clay accent and a high-contrast serif (the AI assistant house look), oversized italic serif headlines, "broadsheet" hairlines with zero radius, monospace micro-labels, 01 / 02 / 03 numbering, middle dot meta strings, "Field notes" style labels |
| Next, already forming | A hand-made "anti-AI" look: grain, hand-drawn type, scrapbook texture added to look human |

Rules that follow from this:

- Never pick a font, palette or component from a "use this instead" list. Those lists become the next wave. Derive choices from the subject.
- Removing a tell is half the job. Swapping purple for teal only moves the default.
- Judge clusters, not single hits. One em dash in a quote, one "however", one rounded card: not slop. Three tells in one paragraph or one screen: slop.

## The method

Run this every time, for a single component or a whole redesign.

### 1. Look at the real thing

Render it and take screenshots at 390 px and 1280 px wide (768 px too for layout work). Judge what people see, not the code.

### 2. Write the direction (five lines, before touching anything)

- **Product:** what it does and for whom, in one plain sentence.
- **Character:** two or three concrete words. Banned: clean, modern, sleek, minimal, premium, beautiful, elegant.
- **World:** the place or material the product belongs to. It sets the tint of the neutrals, the accent and any visual.
- **Moments:** one or two places that get rich colour and detail, taken from what the product shows. Everything else stays quiet.
- **Signature:** one small detail only this product has, used consistently. One, not five.

Then the template check: swap the product's name for a competitor's. If the screen still fits, the direction failed. Show the direction to the owner and wait for a yes before a large change.

### 3. Audit

List every tell from the catalogue below, one line each, with file and line. Then decide how much to change:

- **Heavy slop:** run every pass below.
- **Light slop:** fix only what the audit found. Keep the palette, type and layout.
- **No slop:** say so, suggest at most three small refinements with exact values, and stop. Never change a good screen just to make it different.

### 4. Fix in passes, in this order

Finish each pass across the whole screen before the next:

1. Spacing
2. Colour
3. Icons
4. Copy
5. Type
6. Layout
7. Details (radius, focus, states)
8. Visuals
9. Motion

Spacing comes first because rhythm changes how everything else reads. Copy comes before type because the length of a headline decides its size. Motion comes last.

### 5. Verify

See "Done means" at the end of this file. Screenshots are opened and looked at, in both languages and both colour modes.

## The catalogue of tells

Each line is something to remove, with what replaces it. "Hard" means never, whatever the reason. Everything else needs a one-line reason written down if kept.

### Colour and surface

- Hard: violet, indigo or purple to blue as a default accent. Purple to pink and cyan on dark gradients.
- Hard: gradient text.
- Hard: coloured glows, coloured shadows, radial colour washes, blurred blobs behind content.
- Hard: the cream paper plus terracotta plus high-contrast serif combination (cream: light, hue 22 to 62, noticeably saturated; terracotta, rust or clay accent).
- Hard: near-black with one neon accent and a glow.
- A dark or navy theme as the default with no product reason. A navy or slate dark theme at all: dark should be a true neutral, faintly tinted.
- Framework stock swatches used untouched (Tailwind indigo-500, violet-600, slate-900, blue-600, amber-500).
- An accent on the chrome: tinted nav rows, coloured tab pills, a brand fill on every button, the accent on the help button.
- A border and a shadow on the same card. Pick one, or neither.
- A soft grey shadow under every resting card. Shadows belong on things that float (menus, dialogs, popovers).
- Glass: backdrop blur, translucent cards.
- Pure `#000` or `#fff`. Tint them slightly toward the palette.
- Many near-identical tints for text (five greys or five lavenders). Use three text roles.
- Every element highlighted so nothing stands out. Every chart in shades of the accent.
- Grey text on a coloured surface.
- Colour as the only signal (right and wrong, status).

Replace with:

- One neutral ramp, tinted very slightly toward the product's world.
- Three text roles: primary, secondary, muted. Muted passes 4.5:1 on its surface.
- One accent, under 5 percent of any screen: the primary action, the selection, one key figure. Text on the accent reaches 4.5:1.
- Semantic green and red, toned to sit in the palette, always with a word or icon.
- Depth from one tone step between ground and surface. On dark, surfaces get lighter as they rise and there are no shadows.
- A gradient only as a small tone shift inside one neutral.

### Type

- Hard: tracked capitals as labels. Any text at 15 px or under set in uppercase or small caps, or letter-spaced past 0.03em. Applies to labels, captions, table heads, nav, tags and chips.
- Hard: one italic, coloured or underlined word inside a heading.
- Headings at weight 700 to 900. Use 400 to 500, with 600 only for a rare emphasis. Hierarchy comes from size and colour.
- Nine nearly equal sizes. Use at most five per screen, far apart.
- Title Case headings. Use sentence case (also correct Norwegian).
- Negative letter spacing on text under 16 px. Tight tracking is only for display sizes: -0.02em from 40 px, -0.03em from 56 px.
- Italic for emphasis.
- Monospace as costume on labels and meta. Mono only for code, IDs, or every figure as a single deliberate choice.
- A serif display face as a shortcut to "premium".
- Inter, Roboto, Open Sans, Poppins, Lato, Montserrat, DM Sans or the system face as the display face nobody chose.
- Running text under 12 px, labels under 11 px, captions under 13 px.
- Mixed number formats on one screen.
- Changing weight on hover (the line reflows).

Replace with:

- One family for the interface, plus at most one partner with exactly one job.
- A fixed scale at a ratio of about 1.2.
- Body line height about 1.5 and lines of 45 to 75 characters.
- `text-wrap: balance` on headings and `text-wrap: pretty` on paragraphs.
- `tabular-nums` on figures that line up.
- At least twice the space above a heading as below it.
- Typography details: curly quotes in English, «» in Norwegian, the real ellipsis character, a no-break space between a number and its unit.

### Layout and composition

- Hard: a card inside a card.
- Hard: horizontal scroll at any width from 320 px up.
- The stock landing order: hero, logos, features, how it works, testimonials, stats, pricing, FAQ, CTA, footer.
- A centred hero with a headline, subtitle, two buttons and a screenshot below. Everything centred.
- Three or four equal cards side by side with the same content shape. Equal-width grids by count.
- An eyebrow or pill badge above a heading.
- Numbered 1, 2, 3 "how it works" steps, and "Step 02" labels used as headings.
- Every section in the same container, with the same gap and the same shape.
- A headline over two lines. Aim for about five words.
- A big empty band in the first screen, or a stretch of nothing taller than half a screen.
- A desktop layout squeezed onto a phone (same stack, same padding, same sizes).
- More than about 80 words in one screenful of a landing page.
- A visual on every section.
- A floating action bubble in the corner.

Replace with:

- Each screen answers one question, and its biggest block is the answer.
- Two or three left edges on a page, reused on purpose.
- Space that shows grouping: smaller gaps inside a group than between groups.
- Varied sizes: one main block, smaller supporting blocks of a different kind.
- Phone first, as its own layout: stacked in reading order, its own type step, simpler data views.
- A real state between phone and desktop (roughly 600 to 1024 px), not just two states.

### Components and states

- Hard: a control that does nothing. Wire it, label it as coming later, or remove it.
- Hard: a success message with no request behind it.
- Hard: a focus ring that is missing, fades in, or is under 3:1. Never `outline: none` without a replacement.
- Segmented "On" and "Off" pills for a boolean. Use a real switch; its on colour is ink or semantic green, not the accent.
- Pills for everything. Radius by size, and nested radius: inner equals outer minus padding, never under 4 px.
- One medium radius (12 to 16 px) on everything, which reads as the soft template default.
- A thick coloured stripe on one side of a card (the single most reliable dashboard tell).
- Glowing count pills, "PRO" or "New" badges.
- Stat cards with an icon in a tinted circle, a sparkline and a green "+12%" pill.
- A fat donut chart with the total in the hole.
- Rainbow charts with more than four hues.
- Shimmer skeletons. Loading is the final layout with flat grey bars at their real size and no layout shift.
- An empty state with an illustration and "No data yet". Keep the frame, write one sentence, and offer the one action that fills it.
- An error banner across the whole screen. Show the error inside the block that failed: what broke, when the data was last good, and a retry.
- A mix of autosave and Save buttons on one view. Pick one model.
- Settings that restate their own name. Show what the setting produces next to it ("12 new cards a day").

### Icons

- Hard: emoji used as icons or bullets.
- Hard: two icon libraries on one page.
- The stock AI glyphs: sparkles, brain, magic wand, rocket, lightning, diamond, robot, orb. Flame and trophy count as decoration when they do no work.
- An icon in a tinted rounded square above every heading or card.
- Arrows glued to button and link text ("Get started" followed by an arrow).
- Icons in many sizes and colours.

Replace with:

- The one set the project already uses (GeoDex: lucide).
- One size (16 or 18 px), one stroke (1.5), the colour of the text role.
- A fixed icon box width, so labels align.
- No icon where it adds nothing.

### Motion

Decide by how often the user sees it:

| How often | Treatment |
| --- | --- |
| Hundreds of times a day (keyboard actions) | None |
| Tens of times a day (answering, hovering, list navigation) | Near instant: 100 to 160 ms colour or surface change, press at scale 0.97 to 0.98 |
| Occasional (menus, sheets, dialogs, toasts) | 160 to 250 ms, ease out, exit faster than entry |
| Rare (onboarding tour, level up, end of a session) | Room for delight, 300 to 500 ms |

Tells:

- Hard: `transition: all`, or animating width, height, top, left, margin or padding.
- Hard: animation with no `prefers-reduced-motion` alternative.
- Hard: auto-rotating or looping content with no pause. Anything that moves for more than 5 seconds needs a way to stop it.
- Hard: content hidden at rest that needs JavaScript to appear.
- The same fade and rise on every block, or a dozen staggered entrances.
- Hover lift or scale on every card.
- Bounce, overshoot or elastic easing on ordinary UI.
- `animate-pulse` or `animate-ping` on things that are not live. Breathing glows, floating elements, parallax.
- Count-up numbers. A celebratory toast for something the user can already see.
- Ease-in on UI (it feels sluggish). Animating from `scale(0)`; start from 0.95 with opacity 0.

Replace with:

- One easing curve across the app. GeoDex already uses `cubic-bezier(0.22, 1, 0.36, 1)`.
- An ease-in-out curve for things that move across the screen.
- Only `transform` and `opacity` animated.
- Popovers growing from their trigger.
- Interruptible transitions.
- A stagger of 30 to 60 ms across at most six items.
- A reduced motion path that keeps the state change and drops the movement.

### Interface copy

Banned words:

- unlock, unleash, supercharge, elevate, empower, streamline, seamless, effortless, robust, powerful, cutting-edge, next-generation, world-class, best-in-class, all-in-one, game-changing, revolutionize, magic, journey, delve, dive into, leverage, tapestry, landscape, vibrant, crucial, pivotal, quietly
- For geography content specifically: rich (figurative), nestled, in the heart of, renowned, breathtaking, stunning, hidden gem, bustling, must-visit, boasts, serves as, stands as, features (as a verb for "has"), linked to, tied to

Banned shapes:

- "Not X, but Y", "It's not just X, it's Y", "No X, no Y, just Z"
- A row of three by reflex. Two items usually beat three; use the number the content has.
- Dramatic fragments ("Small change. Big impact."), one-line closers that sum up, quotable slogans.
- Headings that start with What, How or Why. Effect headings ("Knowledge that lasts"). Performative labels ("Field notes", "The details").
- Greeting headlines ("Welcome back, Alex"). The title names the screen or the period.
- Exclamation marks in the interface. Trailing full stops on headings, labels and buttons; paragraphs keep them.
- "Get started", "Learn more", "Try now", "Explore" as button labels. A button names its action: "Start 10 questions".
- Reassurance and justification: "Don't worry", "Help is always here", "lets you", "helps you".
- Changes without a reference ("+12%"). Say what it compares to.
- Invented numbers, testimonials, logos or "trusted by" claims. Every figure on screen comes from the data or the user's settings.
- Placeholders shown to users ("[X]", "Lorem", "John Doe", "Acme").

Questions to ask of every new string, in both languages:

1. Could this sentence sit unchanged in another app? Then it says nothing about this one. Cut it or make it specific.
2. Does it repeat what the screen or the setting's name already says? Cut it.
3. Does it justify or reassure instead of saying what happens? Rewrite it as a fact.
4. Does it contain a contrast trick, a triad, a fragment for drama or a closer? Rewrite.
5. Is there a specific detail nobody could have guessed (a number, a name, a place)? Good. Keep it.

Norwegian:

- «» for quotation marks.
- Sentence case.
- Numbers through `Intl` (`1 240`, `2. nov. 2026`).
- The same plain register as the English. Norwegian strings run longer: no button label or nav item may wrap at 320 px.

### Writing in docs, README and release notes

The same rules as interface copy, plus:

- Lead with the decision or the fact. No intro that previews the sections, and no closing recap that echoes the opening (the "recap loop" is the strongest single tell in prose).
- Vary sentence length; three sentences of the same length in a row is a tell.
- No "It's worth noting", "Importantly", "Let's dive in", "Here's the thing", "In summary".
- No bold label at the start of every bullet unless the labels carry information.
- No headings with emoji or arrows, and no horizontal rule between every section.
- No invented consensus ("Most people..."), and no arguing with an objection nobody raised.
- Keep real hedges only when the fact is uncertain; cut stacked qualifiers.
- Never add a fact, number or name that is not in the source. Ask instead of inventing.
- If a text already reads as human, say so and leave it.

### Not slop

Do not over-correct. These are fine:

- A familiar sans as the body face in an app, when it is chosen on purpose.
- Hairline borders in app screens (tables, lists, panels), at about 6 to 10 percent ink. Not in combination with a shadow.
- Perfect grammar, formal words, a single "however", one short sentence for effect.
- Curly quotes, which are correct typography.
- Conventions native to the subject. For GeoDex, map labels follow cartography: water names in blue italic serif, oceans and continents in spaced capitals, countries in plain sans. Italics and spaced capitals are allowed on the map and nowhere else in the interface.
- A "2 of 5" step counter as quiet text. It is information. The tell is a big "Step 02" label used as a heading.

## Reference values

Starting points, not a house style. When the project has good values, keep them.

| Thing | Value |
| --- | --- |
| Spacing grid | 4 px. Steps 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Related items 2 to 8, groups 12 to 24, sections 32 to 64 |
| Touch targets | 44 px minimum on phones; nothing tappable under 24 px anywhere |
| Phone margins | 16 to 20 px |
| Type sizes (app) | 12, 14, 16, 20, 24, 32; at most five on one screen |
| Weights | 400 and 500; 600 rare |
| Measure | 45 to 75 characters; body line height about 1.5 |
| Radius | One small radius for controls and cards (GeoDex proposal: 6 to 8 px), fully round only for switches and dots |
| Contrast | Body 4.5:1, large text, icons, focus rings and field edges 3:1. Compute it, do not guess |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` for everything; an ease-in-out such as `cubic-bezier(0.77, 0, 0.175, 1)` for on-screen movement |
| Durations | Press and hover 100 to 160 ms, menus 160 to 250 ms, sheets and dialogs 200 to 300 ms, tour and celebration up to 500 ms |
| Accent share | Under 5 percent of any screen |
| Shadows | Only on floating things. Light mode small `0 1px 2px rgb(0 0 0 / 0.05)`, floating `0 8px 24px rgb(0 0 0 / 0.06)`. None in dark |

## Product tours

The owner asked for a smoother tour. The research says:

- Four or five steps. Do not tour the navigation; tour the first real action.
- Step one is a centred card with no target. Later steps put a spotlight on the real control.
- One early step asks for a real action, such as picking a session length.
- The spotlight glides between targets with ease-in-out, about 350 ms. The card fades in and rises about 8 px, growing from the side nearest its target.
- "2 of 5" as small secondary text, then Back, Next and Skip tour. Escape skips. Focus moves into the card, and the page behind is inert. Button labels describe the action where possible.
- The last card is the "Ready?" moment. It says what is set up ("10 questions, Europe first, answers on the map") and offers one button, such as "Start the first session", with a plain text link to look around first. Never end on "That's it!".
- With reduced motion: no glide, only a short crossfade.
- Test it keyboard only, with a screen reader, at 200 percent zoom, and by skipping at step one and checking the app works.

## Accessibility floor

Never waived:

- Visible, instant focus rings at 3:1.
- Logical tab order. Escape closes dialogs.
- Real buttons for actions and links for navigation.
- Labels on every field.
- `aria-label` on icon-only buttons; decorative icons get `aria-hidden`.
- Alt text on images.
- One h1 per page and no skipped heading levels. `lang` on the page.
- Contrast as above, in both modes.
- No zoom blocking.
- A reduced motion path.
- Status never by colour alone.

## GeoDex: where things stand

### Context

GeoDex is a spaced repetition geography trainer (React, Vite, Tailwind, Dexie, ts-fsrs). It is at version 1.0 and private. The owner plans to make it public soon and wants these in the same push:

- A full UI revamp with no slop.
- A full test pass.
- Login removed, with progress still saved on each device and nobody ever seeing another person's data.
- A site that cannot be taken down.
- A smoother tour.

None of that is decided in detail. A Q&A happens when the owner says "Ready", and the agreed plan goes into its own .md.

Note for that Q&A: optional cloud sync with email sign-in is switched on in the live build. Removing login means deciding what replaces it.

### Direction draft (to confirm in the Q&A)

- **Product:** a geography trainer that schedules every country, capital and flag so you remember them for years.
- **Character:** exact, calm, a little dry.
- **World:** a printed school atlas and a wall map in daylight. Paper, ink, sea blue, land in pale tints.
- **Moments:** the map in every question, and the flags. They are the only places with full colour.
- **Signature:** the graticule. Thin latitude and longitude lines, only on the map, at the same line weight as progress bars.

### Audit of version 1.0

The full list with file and line is in `UNSLOP.md`. The main findings:

Themes and colour:

- Three themes (Atlas, Minimal, Playful) are three separate designs to keep consistent.
- Atlas, the default, is dark navy with an amber accent and colour glows.
- Playful uses violet (`#6c4ab6`) with a violet shadow and bounce easing.

Welcome page:

- A pill badge above the headline, nine icon tiles, numbered 1-2-3 steps and the stock section order.
- A globe that spins continuously with no pause control.
- On a phone it is 5743 px tall, which is the desktop layout squeezed.

Components and type:

- A floating accent-coloured help button in the corner.
- Hover lift on cards in Help and on the answer buttons.
- Tracked capitals headers in the Atlas list.
- A 10.4 px caption on the goal ring.
- A middle dot string between rank and XP level.
- On and Off pills used for booleans in Settings.

Icons:

- Sparkles, Brain, Flame and Award are used as decoration.
- Arrows are glued to button labels.

Copy:

- "Free. No ads, no account, no tracking."
- The slogan headline "Learn the world, and keep it."
- What, How and Why headings.
- A dramatic closer in the memory section.
- Tour steps that walk through the navigation.

What is already good and stays:

- The fonts: Schibsted Grotesk is on no overused list and was made for a Norwegian media group.
- The country content: VOICE.md and the content linter already ban the travel guide words.
- Specific copy such as "You never grade yourself. Wrong is wrong."
- The time estimate built from the user's own settings.
- No `transition-all`, no pulse animations and no exclamation marks in the strings.
- One easing curve.

### Proposals from the research (all pending the Q&A)

| Decision | Pick | Reason |
| --- | --- | --- |
| Default mode | Light, with a dark mode derived from the same tokens | An atlas is paper; a dark default with no reason is a listed tell |
| Themes | One system: light, dark, match device | Three themes drift, and Playful carries violet and bounce |
| Palette | "Paper and sea": ground `#f7fbfc`, ink `#121c23`, muted `#606b72`, accent `#006495`, sea `#cae3ed`, land `#fcfcf9`; dark ground `#0c1316`, ink `#e6ecef`, accent `#6eacd7` | Contrast computed: ink 16.6:1, muted 5.3:1, text on accent 6.2:1; dark ink 15.8:1, muted 7.1:1 |
| Fonts | Schibsted Grotesk for everything; Newsreader italic only for physical features on the map, or dropped | Gives the serif one job taken from cartography |
| Navigation on phones | Bottom bar: Today, Atlas, Stats, Settings, Help | Thumb reach; replaces the floating help bubble |
| Today | Start button first, map, one level bar, goal as one line of text | Today answers "what do I do now" |
| XP and ranks | One line on Today, details in Stats | Keeps Today to the next action |
| Welcome | One live question on the map, then the start button | Showing the product beats describing it |
| Settings | Rows with real switches, autosave with a quiet "Saved", each row shows its effect | One save model; settings show what they produce |

Alternatives that were drawn and judged are in `examples.html`:

- Palettes: Night chart, Topographic green, Wall map red, Ink only.
- Fonts: Public Sans with Source Serif, IBM Plex with Mono figures, Atkinson Hyperlegible Next.

### Open questions for the Q&A

- Light or dark by default?
- One system or the three themes?
- Keep Newsreader for map water and mountains, or one family only?
- What should a first-time visitor see first?
- Bottom bar on phones?
- XP and ranks: where, and how loud?
- Keep, tone down or drop the streak flame and the level up celebration?
- The accent colour: ink blue, a deep green, or something else from a printed atlas?

## Done means

Before calling any UI or copy work finished:

- [ ] Screenshots at 390, 768 and 1280 px, in light and dark, in English and Norwegian, each opened and looked at.
- [ ] The five-second test: a stranger can say what the screen is and what to do next.
- [ ] The squint test: two or three clear masses, one of them first.
- [ ] The template check: swap the name for a competitor's; it must no longer fit.
- [ ] No tell from the catalogue left without a written one-line reason.
- [ ] Contrast computed for every new colour pair, in both modes.
- [ ] Keyboard only, screen reader, 200 percent zoom and reduced motion all work.
- [ ] No horizontal scroll from 320 px, no button label wrapping.
- [ ] Every control does something; the e2e run clicks through them.
- [ ] Copy run through the five questions above; no em or en dashes; no banned words.
- [ ] Empty, loading and error states drawn for every block that shows data.

## Sources, if deeper detail is needed

All free to read on GitHub. These were downloaded and read in full or in part:

| Source | Best for |
| --- | --- |
| heydamir/unslop | The nine-pass method, the five-line direction, token starting values, the sign list |
| Leonxlnx/taste-skill | The dated tell registry, colour proportions, app screen rules from a study of 23 real dashboards, phone rules |
| Nutlope/hallmark | About 85 numbered gates with tiers (never, needs a reason, finish), fonts banned as defaults, dark mode derivation |
| pbakaus/impeccable | A deterministic detector, "quieter" mode for tools, audit dimensions |
| funboy322/avoid-ai-design | The 67-tell catalogue, aesthetic directions with their traps, a DESIGN.md template |
| miqdadbadjuber/anti-slop | Rules R-01 to R-40 in three tiers, a delivery gate, a mobile layout skill |
| Vinayak-Shukla-03/anti-ai-slop | Nine hard rules and a twelve-point self-audit |
| ibelick/ui-skills (baseline-ui) | A short list of must and never rules for UI code |
| vercel-labs/web-interface-guidelines | Accessibility, forms, motion, i18n and state rules for code review |
| emilkowalski/skills | When and how to animate |
| blader/humanizer, hardikpandya/stop-slop, theclaymethod/unslop | Writing tells and how to fix them without over-editing |
| nishchay-bhudia/unslop | Rewriting social posts. Useful only for its rules about never inventing facts and asking for real detail |
| Wikipedia, "Signs of AI writing" | The base list most writing skills build on |
| Imhof's label placement work and the Felt and Mapbox map design guides | Cartographic conventions for the map |
