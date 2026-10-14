/**
 * Fast orthographic projection for the globe. Points are precomputed as unit vectors, so a
 * frame costs two dot products per point instead of d3's projection stream with clipping and
 * resampling. Points on the far side are pinned to the rim, which keeps filled shapes closed
 * at the horizon. Pure: no DOM.
 */

export type Vec3 = [number, number, number];
const RAD = Math.PI / 180;

export function toVec([lon, lat]: readonly [number, number] | readonly number[]): Vec3 {
  const l = (lon ?? 0) * RAD;
  const p = (lat ?? 0) * RAD;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

export function toLonLat([x, y, z]: Vec3): [number, number] {
  return [Math.atan2(y, x) / RAD, Math.asin(Math.max(-1, Math.min(1, z))) / RAD];
}

/** Screen basis for a globe facing [lon, lat]: east and north on screen, and the view axis. */
export type Basis = { east: Vec3; north: Vec3; view: Vec3 };

export function basisFacing(lon: number, lat: number): Basis {
  const l = lon * RAD;
  const p = lat * RAD;
  return {
    view: [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)],
    east: [-Math.sin(l), Math.cos(l), 0],
    north: [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)],
  };
}

/** Flattened unit vectors: [x0, y0, z0, x1, y1, z1, ...]. */
export function packRing(ring: readonly (readonly number[])[]): Float64Array {
  const out = new Float64Array(ring.length * 3);
  ring.forEach((point, i) => {
    const [x, y, z] = toVec(point);
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  });
  return out;
}

/**
 * Projects point i of a packed ring. Returns depth too: positive is the near side. Far-side
 * points are pinned to the rim in their screen direction.
 */
export function projectPacked(
  packed: Float64Array,
  i: number,
  basis: Basis,
  radius: number,
  cx: number,
  cy: number,
  out: { x: number; y: number; depth: number },
): void {
  const x = packed[i * 3] ?? 0;
  const y = packed[i * 3 + 1] ?? 0;
  const z = packed[i * 3 + 2] ?? 0;
  const e = x * basis.east[0] + y * basis.east[1] + z * basis.east[2];
  const n = x * basis.north[0] + y * basis.north[1] + z * basis.north[2];
  const d = x * basis.view[0] + y * basis.view[1] + z * basis.view[2];
  let sx = e;
  let sy = n;
  if (d < 0) {
    const len = Math.hypot(e, n) || 1;
    sx = e / len;
    sy = n / len;
  }
  out.x = cx + sx * radius;
  out.y = cy - sy * radius;
  out.depth = d;
}

/** The [lon, lat] under a screen point, or null off the globe. */
export function invert(
  sx: number,
  sy: number,
  basis: Basis,
  radius: number,
  cx: number,
  cy: number,
): [number, number] | null {
  const e = (sx - cx) / radius;
  const n = -(sy - cy) / radius;
  const r2 = e * e + n * n;
  if (r2 > 1) return null;
  const d = Math.sqrt(1 - r2);
  const v: Vec3 = [
    e * basis.east[0] + n * basis.north[0] + d * basis.view[0],
    e * basis.east[1] + n * basis.north[1] + d * basis.view[1],
    e * basis.east[2] + n * basis.north[2] + d * basis.view[2],
  ];
  return toLonLat(v);
}

/** A ring with its bounding cap, for culling without projecting its points. */
export type PackedRing = { points: Float64Array; center: Vec3; radius: number };

export function packRingWithCap(ring: readonly (readonly number[])[]): PackedRing {
  const points = packRing(ring);
  let x = 0;
  let y = 0;
  let z = 0;
  const n = points.length / 3;
  for (let i = 0; i < n; i++) {
    x += points[i * 3] ?? 0;
    y += points[i * 3 + 1] ?? 0;
    z += points[i * 3 + 2] ?? 0;
  }
  const len = Math.hypot(x, y, z) || 1;
  const center: Vec3 = [x / len, y / len, z / len];
  let radius = 0;
  for (let i = 0; i < n; i++) {
    const dot =
      (points[i * 3] ?? 0) * center[0] +
      (points[i * 3 + 1] ?? 0) * center[1] +
      (points[i * 3 + 2] ?? 0) * center[2];
    radius = Math.max(radius, Math.acos(Math.max(-1, Math.min(1, dot))));
  }
  return { points, center, radius };
}

/**
 * Whether a ring can show: not wholly on the far side, and at least `minPx` across on a
 * globe of radius `r` pixels.
 */
export function ringVisible(ring: PackedRing, basis: Basis, r: number, minPx: number): boolean {
  if (ring.radius * r < minPx) return false;
  const d =
    ring.center[0] * basis.view[0] +
    ring.center[1] * basis.view[1] +
    ring.center[2] * basis.view[2];
  // Angular distance from the view center minus the cap radius must be under 90 degrees.
  return Math.acos(Math.max(-1, Math.min(1, d))) - ring.radius < Math.PI / 2;
}
