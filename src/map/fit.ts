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
  return { k, x: width / 2 - k * cx, y: height / 2 - k * cy };
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

/** Degrees of longitude per screen pixel when a map of this projected width is dragged. */
export function degreesPerPixel(sphereWidth: number, k: number): number {
  return 360 / Math.max(1, sphereWidth * k);
}

/** Keeps every nth vertex of each ring (ends kept, small rings intact), for drawing while dragging. */
export function decimateRing<T>(ring: readonly T[], n: number): T[] {
  if (ring.length <= 8 || n <= 1) return [...ring];
  const out = ring.filter((_, i) => i % n === 0);
  const last = ring[ring.length - 1] as T;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
