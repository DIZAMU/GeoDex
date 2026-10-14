/** Geometry helpers for the physical build. Pure, deterministic. */

export type Point = [number, number];

/** Douglas-Peucker on a line in degrees: keeps the ends and every vertex off by more than `tolerance`. */
export function simplifyLine(line: readonly Point[], tolerance: number): Point[] {
  if (line.length <= 2) return line.map((p) => [p[0], p[1]]);
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop() as [number, number];
    const [ax, ay] = line[a] as Point;
    const [bx, by] = line[b] as Point;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let best = -1;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = line[i] as Point;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > best) {
        best = d;
        index = i;
      }
    }
    if (best > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return line.filter((_, i) => keep[i]).map((p) => [p[0], p[1]]);
}

/** A closed ring simplified, or null when too little is left to be a polygon. */
export function simplifyRing(ring: readonly Point[], tolerance: number): Point[] | null {
  const out = simplifyLine(ring, tolerance);
  return out.length >= 4 ? out : null;
}

export function round2(p: readonly number[]): Point {
  return [Math.round((p[0] ?? 0) * 100) / 100, Math.round((p[1] ?? 0) * 100) / 100];
}

/** Planar length of a line in degrees, for picking the longest part. */
export function lineLength(line: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as Point;
    const b = line[i] as Point;
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

/** The vertex halfway along a line by length. */
export function midpoint(line: readonly Point[]): Point {
  const half = lineLength(line) / 2;
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as Point;
    const b = line[i] as Point;
    walked += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (walked >= half) return [b[0], b[1]];
  }
  return line[line.length - 1] as Point;
}
