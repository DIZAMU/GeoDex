import { geoOrthographic } from "d3-geo";
import { describe, expect, it } from "vitest";
import {
  basisFacing,
  invert,
  packRing,
  packRingWithCap,
  projectPacked,
  ringVisible,
  toLonLat,
  toVec,
} from "./orthographic";

const out = { x: 0, y: 0, depth: 0 };

describe("fast orthographic projection", () => {
  it("round-trips lon/lat through unit vectors", () => {
    const [lon, lat] = toLonLat(toVec([10.75, 59.91]));
    expect(lon).toBeCloseTo(10.75);
    expect(lat).toBeCloseTo(59.91);
  });

  it("matches d3's orthographic projection on the near side", () => {
    const center: [number, number] = [12, 60];
    const radius = 300;
    const d3 = geoOrthographic()
      .scale(radius)
      .translate([400, 300])
      .rotate([-center[0], -center[1]])
      .clipAngle(90);
    const basis = basisFacing(center[0], center[1]);
    for (const point of [
      [12, 60],
      [10.75, 59.91],
      [-3, 40],
      [30, 70],
      [24, 45],
    ] as [number, number][]) {
      projectPacked(packRing([point]), 0, basis, radius, 400, 300, out);
      const expected = d3(point) as [number, number];
      expect(out.x).toBeCloseTo(expected[0], 6);
      expect(out.y).toBeCloseTo(expected[1], 6);
      expect(out.depth).toBeGreaterThan(0);
    }
  });

  it("pins far-side points to the rim", () => {
    const basis = basisFacing(0, 0);
    projectPacked(packRing([[170, 10]]), 0, basis, 100, 0, 0, out);
    expect(out.depth).toBeLessThan(0);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(100);
  });

  it("inverts screen points and rejects points off the globe", () => {
    const basis = basisFacing(12, 60);
    projectPacked(packRing([[20, 55]]), 0, basis, 250, 300, 300, out);
    const back = invert(out.x, out.y, basis, 250, 300, 300);
    expect(back?.[0]).toBeCloseTo(20);
    expect(back?.[1]).toBeCloseTo(55);
    expect(invert(0, 0, basis, 100, 300, 300)).toBeNull();
  });
});

describe("ring culling", () => {
  const square = (lon: number, lat: number, size: number) => [
    [lon, lat],
    [lon + size, lat],
    [lon + size, lat + size],
    [lon, lat + size],
    [lon, lat],
  ];

  it("keeps rings facing the viewer and drops rings behind the globe", () => {
    const basis = basisFacing(0, 0);
    expect(ringVisible(packRingWithCap(square(0, 0, 5)), basis, 300, 0.5)).toBe(true);
    expect(ringVisible(packRingWithCap(square(175, 0, 5)), basis, 300, 0.5)).toBe(false);
    // Straddling the horizon still shows.
    expect(ringVisible(packRingWithCap(square(88, 0, 5)), basis, 300, 0.5)).toBe(true);
  });

  it("drops rings smaller than the pixel threshold", () => {
    const basis = basisFacing(0, 0);
    expect(ringVisible(packRingWithCap(square(0, 0, 0.01)), basis, 300, 1)).toBe(false);
    expect(ringVisible(packRingWithCap(square(0, 0, 0.01)), basis, 30000, 1)).toBe(true);
  });
});
