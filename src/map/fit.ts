/** Zoom transform that fits projected bounds into a viewport. Pure. */

export type Bounds = [[number, number], [number, number]];
export type Transform = { k: number; x: number; y: number };

export const MAX_ZOOM = 40;

export function fitTransform(
  bounds: Bounds,
  width: number,
  height: number,
  padding = 0.08,
  maxZoom = MAX_ZOOM,
): Transform {
  const [[x0, y0], [x1, y1]] = bounds;
  const dx = Math.max(x1 - x0, 1);
  const dy = Math.max(y1 - y0, 1);
  const k = Math.min(maxZoom, Math.max(1, (1 - 2 * padding) / Math.max(dx / width, dy / height)));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  // Centered, but never past the map's own edges: a country at the edge sits at the edge of
  // the view, so the view matches what dragging allows and the first drag does not jump.
  const clamp = (value: number, size: number) => Math.min(0, Math.max(size - k * size, value));
  return { k, x: clamp(width / 2 - k * cx, width), y: clamp(height / 2 - k * cy, height) };
}

export function unionBounds(list: readonly Bounds[]): Bounds | null {
  const finite = list.filter((b) => b.flat().every(Number.isFinite));
  if (finite.length === 0) return null;
  return [
    [Math.min(...finite.map((b) => b[0][0])), Math.min(...finite.map((b) => b[0][1]))],
    [Math.max(...finite.map((b) => b[1][0])), Math.max(...finite.map((b) => b[1][1]))],
  ];
}

/** Projected area in screen pixels after zoom. */
export function screenArea(projectedArea: number, k: number): number {
  return projectedArea * k * k;
}

/** Countries smaller than this on screen get a tappable marker (PLAN.md 8.4). */
export const MARKER_AREA_PX = 30;

/** Screen radius of a marker dot, and of its larger tap target. */
export const MARKER_DOT_PX = 5;
export const MARKER_HIT_PX = 22;

/**
 * Which country a tap means. A marker's visible dot wins, then the country shape under the
 * pointer, then the nearest marker whose tap target contains the point. Without this order,
 * the tap targets of small countries (Belgium, Denmark) cover their large neighbors.
 */
export function pickCountry(
  point: readonly [number, number],
  markers: readonly { id: string; x: number; y: number }[],
  shapeId: string | null,
): string | null {
  let nearest: { id: string; d: number } | null = null;
  for (const m of markers) {
    const d = Math.hypot(m.x - point[0], m.y - point[1]);
    if (!nearest || d < nearest.d) nearest = { id: m.id, d };
  }
  if (nearest && nearest.d <= MARKER_DOT_PX + 4) return nearest.id;
  if (shapeId) return shapeId;
  return nearest && nearest.d <= MARKER_HIT_PX ? nearest.id : null;
}

/** Keeps every nth vertex of each ring (ends kept, small rings intact), for drawing while dragging. */
export function decimateRing<T>(ring: readonly T[], n: number): T[] {
  if (ring.length <= 8 || n <= 1) return [...ring];
  const out = ring.filter((_, i) => i % n === 0);
  const last = ring[ring.length - 1] as T;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * Drops vertices closer than `tolerance` degrees to the last kept one (ends kept, at least
 * four points so rings stay closed polygons). Cheap simplification for drawing in motion.
 */
export function simplifyRing<T extends readonly number[]>(
  ring: readonly T[],
  tolerance: number,
): T[] {
  if (ring.length <= 8) return [...ring];
  const out: T[] = [ring[0] as T];
  for (let i = 1; i < ring.length - 1; i++) {
    const p = ring[i] as T;
    const q = out[out.length - 1] as T;
    if (Math.abs((p[0] ?? 0) - (q[0] ?? 0)) + Math.abs((p[1] ?? 0) - (q[1] ?? 0)) >= tolerance)
      out.push(p);
  }
  out.push(ring[ring.length - 1] as T);
  while (out.length < 4) out.splice(out.length - 1, 0, ring[Math.floor(ring.length / 2)] as T);
  return out;
}
