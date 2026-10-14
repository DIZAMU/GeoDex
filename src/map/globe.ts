/** Pure helpers for the orthographic globe (GlobeMap). No DOM. */

export type Rotation = { lambda: number; phi: number };

/** Tilt stops short of the poles so the globe never flips upside down. */
export const MAX_TILT = 80;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 12;
/** Inertia keeps this share of its velocity per 16 ms frame. */
export const FRICTION = 0.92;
/** Below this speed (degrees per frame) inertia stops. */
export const MIN_SPEED = 0.02;

/** Degrees the globe turns per screen pixel dragged, so the point under the finger follows it. */
export function degreesPerPixel(radius: number): number {
  return 180 / (Math.PI * Math.max(1, radius));
}

/** Longitude wraps to [-180, 180); tilt clamps to the polar limit. */
export function normalize({ lambda, phi }: Rotation): Rotation {
  const wrapped = ((((lambda + 180) % 360) + 360) % 360) - 180;
  return { lambda: wrapped, phi: Math.max(-MAX_TILT, Math.min(MAX_TILT, phi)) };
}

/** Rotation after dragging by (dx, dy) screen pixels on a globe of this radius. */
export function dragRotation(start: Rotation, dx: number, dy: number, radius: number): Rotation {
  const step = degreesPerPixel(radius);
  return normalize({ lambda: start.lambda + dx * step, phi: start.phi - dy * step });
}

export function clampZoom(k: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, k));
}

/** One inertia frame: the new rotation and the decayed velocity, or null once it has stopped. */
export function inertiaStep(
  rotation: Rotation,
  velocity: { lambda: number; phi: number },
  frames: number,
): { rotation: Rotation; velocity: { lambda: number; phi: number } } | null {
  const decay = FRICTION ** frames;
  const next = { lambda: velocity.lambda * decay, phi: velocity.phi * decay };
  if (Math.hypot(next.lambda, next.phi) < MIN_SPEED) return null;
  return {
    rotation: normalize({
      lambda: rotation.lambda + next.lambda * frames,
      phi: rotation.phi + next.phi * frames,
    }),
    velocity: next,
  };
}

/** Rotation that puts [lon, lat] at the center, tilting at most `maxTilt` degrees. */
export function centerOn([lon, lat]: readonly [number, number], maxTilt = MAX_TILT): Rotation {
  return normalize({ lambda: -lon, phi: -Math.max(-maxTilt, Math.min(maxTilt, lat)) });
}
