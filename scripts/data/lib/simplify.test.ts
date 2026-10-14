import { describe, expect, it } from "vitest";
import { lineLength, midpoint, simplifyLine, simplifyRing } from "./simplify.ts";

describe("physical geometry helpers", () => {
  it("drops vertices within the tolerance and keeps the ends and corners", () => {
    const line: [number, number][] = [
      [0, 0],
      [1, 0.01],
      [2, 0],
      [2, 2],
    ];
    expect(simplifyLine(line, 0.1)).toEqual([
      [0, 0],
      [2, 0],
      [2, 2],
    ]);
    expect(simplifyLine(line, 0.001)).toHaveLength(4);
  });

  it("drops rings that collapse", () => {
    const tiny: [number, number][] = [
      [0, 0],
      [0.001, 0],
      [0.001, 0.001],
      [0, 0],
    ];
    expect(simplifyRing(tiny, 0.1)).toBeNull();
  });

  it("measures lines and finds their middle", () => {
    const line: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    expect(lineLength(line)).toBe(3);
    expect(midpoint(line)).toEqual([2, 0]);
  });
});
