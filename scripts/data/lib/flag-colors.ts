/** Named flag colors. Pixels map to the nearest one, so similar flags share names. */
export const FLAG_PALETTE = {
  red: [206, 17, 38],
  maroon: [122, 24, 52],
  orange: [255, 130, 0],
  yellow: [252, 209, 22],
  green: [0, 154, 68],
  lightblue: [93, 173, 226],
  blue: [0, 56, 168],
  white: [255, 255, 255],
  black: [0, 0, 0],
} as const satisfies Record<string, readonly [number, number, number]>;

export type FlagColor = keyof typeof FLAG_PALETTE;
export type FlagColorShare = { color: FlagColor; share: number };

const NAMES = Object.keys(FLAG_PALETTE) as FlagColor[];

export function nearestColor(r: number, g: number, b: number): FlagColor {
  let best: FlagColor = "white";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const name of NAMES) {
    const [pr, pg, pb] = FLAG_PALETTE[name];
    // Weighted RGB distance, closer to perceived difference than plain Euclidean.
    const distance = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

/** Shares of palette colors in RGBA pixels, keeping those at or above minShare. */
export function dominantColors(rgba: Uint8Array, minShare = 0.05): FlagColorShare[] {
  const counts = new Map<FlagColor, number>();
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if ((rgba[i + 3] ?? 0) < 128) continue;
    const color = nearestColor(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
    counts.set(color, (counts.get(color) ?? 0) + 1);
    total++;
  }
  return [...counts]
    .map(([color, count]) => ({ color, share: Math.round((count / total) * 100) / 100 }))
    .filter((entry) => entry.share >= minShare)
    .sort((a, b) => b.share - a.share || a.color.localeCompare(b.color));
}
