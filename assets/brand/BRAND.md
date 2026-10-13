# Geodex brand

The Geodex mark is a disc with a G cut out of it. The G's bar is the equator and ends in an amber dot, and a faint meridian sits inside the G. Every file is vector-outlined (no live text, no strokes in the G), so it renders identically everywhere.

## Colors

| Name | Hex | Use |
|---|---|---|
| Abyss | `#0E2433` | Primary disc, app icon background, dark UI |
| Ink | `#E7EEF2` | Disc on dark backgrounds, G on the app icon |
| Buoy | `#F4B740` | The dot. The only accent. Never recolor it |
| Snow | `#F6F8FA` | Light backgrounds |

These match the Atlas and Minimal theme tokens in `PLAN.md` section 8.

## Which file to use

| Situation | File |
|---|---|
| Mark on light backgrounds | `svg/geodex-mark.svg` |
| Mark on dark backgrounds | `svg/geodex-mark-on-dark.svg` |
| Mark at 32 px or smaller | `svg/geodex-mark-small.svg`, `svg/geodex-mark-small-on-dark.svg` |
| Single color (print, stamps, embossing) | `svg/geodex-mark-mono.svg` (uses `currentColor`; no dot, no meridian) |
| App icon, PWA icon, apple-touch-icon | `svg/geodex-app-icon.svg` (full-bleed square; the OS applies corner rounding) |
| Browser tab | `web/favicon.svg` (switches with light/dark mode), `web/favicon.ico` (16/32/48 fallback) |
| Header, README, docs | `svg/geodex-lockup.svg`, `svg/geodex-lockup-on-dark.svg` |
| Name only | `svg/geodex-wordmark.svg`, `svg/geodex-wordmark-on-dark.svg` |
| Link previews | `png/social/og-image.png` (1200x630), `png/social/github-social-preview.png` (1280x640) |

PNG renders of every file are in `png/` at the sizes listed in their filenames. The mark goes up to 2048 px, lockups up to 2400 px wide.

## Rules

- **Clear space:** keep at least 25% of the disc's diameter empty on every side of the mark. For the lockup, measure from the disc.
- **Minimum size:** the main mark at 48 px or larger. Below 48 px use the small variant, which has a heavier G, a wider opening, a bigger dot and no meridian. The lockup at 24 px tall or larger.
- **Backgrounds:** use the Abyss disc on light backgrounds and the Ink disc on dark ones. On photos or busy backgrounds, use the app icon instead.
- **Do not:**
  - Stretch, rotate or recolor the mark.
  - Add shadows, outlines, gradients or glows.
  - Move the dot.
  - Put the Abyss disc on a dark background.
  - Retype the wordmark in a live font.

## Construction

- The disc is r = 46 on a 100-unit grid; the SVG viewBox crops to the disc (4 4 92 92).
- The G is centerline radius 28, weight 8, opening from -30 degrees to the equator, with round terminals, a round outer join and a 2-unit fillet where the bar meets the bowl. The bar ends at x = 57.
- The dot is r = 6.5 at (57, 50). The meridian is a 2.5-unit arc, kept 2 units clear of the G's inner edge.
- The small variant uses radius 26.5, weight 11.5, opening -44 degrees and dot r = 8.5.
- The app icon and maskable icon keep the G inside the central 80% safe zone.

## Typography

The wordmark is Schibsted Grotesk Bold with -0.02 em tracking, converted to outlines. Schibsted Grotesk is licensed under the SIL Open Font License 1.1. In the lockup, the wordmark's cap height is 42% of the disc's height, centered on the equator bar.
