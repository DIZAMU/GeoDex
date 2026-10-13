// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEMES } from "./themes";

const css = readFileSync(new URL("./themes.css", import.meta.url), "utf8");

function tokens(theme: string): Record<string, string> {
  const block = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`));
  if (!block?.[1]) throw new Error(`No block for theme ${theme}`);
  const entries = [...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(
    (m) => [m[1], m[2]] as [string, string],
  );
  return Object.fromEntries(entries);
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

// WCAG AA: 4.5:1 for text, 3:1 for graphical objects and focus indicators.
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["foreground", "muted"],
  ["primary", "background"],
  ["primary", "card"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive", "background"],
  ["destructive", "card"],
];

const GRAPHIC_PAIRS: [string, string][] = [
  ["ring", "background"],
  ["ring", "card"],
  ["map-border", "map-ocean"],
  ["map-border", "map-land"],
];

describe.each(THEMES)("%s theme", (theme) => {
  const t = tokens(theme);

  it.each(TEXT_PAIRS)("%s on %s meets 4.5:1", (fg, bg) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(contrast(t[fg] ?? "", t[bg] ?? "")).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHIC_PAIRS)("%s on %s meets 3:1", (fg, bg) => {
    expect(contrast(t[fg] ?? "", t[bg] ?? "")).toBeGreaterThanOrEqual(3);
  });
});

// Mastery ramps are sequential: luminance moves one way from level 0 to 4, never red to green.
describe.each(THEMES)("%s mastery ramp", (theme) => {
  const t = tokens(theme);
  it("is monotonic in luminance", () => {
    const l = [0, 1, 2, 3, 4].map((i) => luminance(t[`mastery-${i}`] ?? "#000000"));
    const up = l.every((v, i) => i === 0 || v > (l[i - 1] ?? 0));
    const down = l.every((v, i) => i === 0 || v < (l[i - 1] ?? 1));
    expect(up || down).toBe(true);
  });
});
