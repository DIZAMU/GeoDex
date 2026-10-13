/** Small spherical helpers shared by the engine. */

const RAD = Math.PI / 180;
export const EARTH_RADIUS_KM = 6371;

export function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Mean position of points on the sphere ([lon, lat]), safe across the antimeridian. */
export function sphericalMean(points: readonly (readonly [number, number])[]): [number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lon, lat] of points) {
    x += Math.cos(lat * RAD) * Math.cos(lon * RAD);
    y += Math.cos(lat * RAD) * Math.sin(lon * RAD);
    z += Math.sin(lat * RAD);
  }
  return [Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD];
}
