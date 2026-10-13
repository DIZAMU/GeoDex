import { describe, expect, it } from "vitest";
import { fitTransform, unionBounds } from "./fit";

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
