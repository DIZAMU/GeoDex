import { describe, expect, it } from "vitest";
import { dominantColors, nearestColor } from "./flag-colors.ts";

function pixels(colors: [number, number, number][]): Uint8Array {
  return new Uint8Array(colors.flatMap(([r, g, b]) => [r, g, b, 255]));
}

describe("nearestColor", () => {
  it("maps typical flag shades to their names", () => {
    expect(nearestColor(186, 12, 47)).toBe("red"); // Norway red
    expect(nearestColor(0, 32, 91)).toBe("blue"); // Norway blue
    expect(nearestColor(0, 122, 61)).toBe("green");
    expect(nearestColor(255, 255, 255)).toBe("white");
  });
});

describe("dominantColors", () => {
  it("returns shares above the threshold, largest first", () => {
    const result = dominantColors(
      pixels([...Array(6).fill([206, 17, 38]), ...Array(3).fill([255, 255, 255]), [0, 0, 0]]),
      0.2,
    );
    expect(result).toEqual([
      { color: "red", share: 0.6 },
      { color: "white", share: 0.3 },
    ]);
  });
});
