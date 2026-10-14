import { describe, expect, it } from "vitest";
import { decimateRing, degreesPerPixel, fitTransform, pickCountry, unionBounds } from "./fit";

describe("fitTransform", () => {
  it("centers and scales bounds into the viewport with padding", () => {
    const t = fitTransform(
      [
        [100, 100],
        [200, 150],
      ],
      1000,
      500,
      0,
    );
    expect(t.k).toBe(10);
    expect(t.x + t.k * 150).toBe(500);
    expect(t.y + t.k * 125).toBe(250);
  });

  it("never zooms out past the world view or beyond the maximum", () => {
    expect(
      fitTransform(
        [
          [0, 0],
          [5000, 5000],
        ],
        1000,
        500,
      ).k,
    ).toBe(1);
    expect(
      fitTransform(
        [
          [10, 10],
          [10.1, 10.1],
        ],
        1000,
        500,
      ).k,
    ).toBe(40);
  });
});

describe("unionBounds", () => {
  it("covers every bounds and ignores empty ones", () => {
    expect(
      unionBounds([
        [
          [0, 5],
          [10, 20],
        ],
        [
          [-5, 8],
          [4, 30],
        ],
        [
          [Number.NaN, 0],
          [0, 0],
        ],
      ]),
    ).toEqual([
      [-5, 5],
      [10, 30],
    ]);
    expect(unionBounds([])).toBeNull();
  });
});

describe("pickCountry", () => {
  const markers = [
    { id: "BEL", x: 100, y: 100 },
    { id: "LUX", x: 110, y: 112 },
  ];

  it("prefers the country shape under the pointer over a nearby tap target", () => {
    expect(pickCountry([100, 118], markers, "NOR")).toBe("NOR");
  });

  it("lets a marker's visible dot win over the shape beneath it", () => {
    expect(pickCountry([101, 101], markers, "FRA")).toBe("BEL");
  });

  it("falls back to the nearest tap target over open sea", () => {
    expect(pickCountry([112, 125], markers, null)).toBe("LUX");
    expect(pickCountry([300, 300], markers, null)).toBeNull();
  });
});

describe("degreesPerPixel", () => {
  it("turns a full map width into a full turn, less when zoomed in", () => {
    expect(degreesPerPixel(720, 1) * 720).toBeCloseTo(360);
    expect(degreesPerPixel(720, 4)).toBeCloseTo(0.125);
  });
});

describe("decimateRing", () => {
  it("keeps closure and leaves small rings intact", () => {
    const ring = Array.from({ length: 20 }, (_, i) => [i, 0] as [number, number]);
    ring.push(ring[0] as [number, number]);
    const out = decimateRing(ring, 5);
    expect(out[0]).toBe(ring[0]);
    expect(out.at(-1)).toBe(ring.at(-1));
    expect(out.length).toBeLessThan(ring.length);
    expect(decimateRing(ring.slice(0, 6), 5)).toHaveLength(6);
  });
});
