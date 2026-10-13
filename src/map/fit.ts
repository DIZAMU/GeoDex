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
