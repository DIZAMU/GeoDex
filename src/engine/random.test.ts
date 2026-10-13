import { describe, expect, it } from "vitest";
import { createRng, hashString, shuffle, weightedPick } from "./random";

describe("createRng", () => {
  it("gives the same sequence for the same seed", () => {
    const a = createRng("NOR:map_to_name#3");
    const b = createRng("NOR:map_to_name#3");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("gives different sequences for different seeds", () => {
    expect(createRng("a")()).not.toBe(createRng("b")());
  });

  it("stays in [0, 1)", () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("helpers", () => {
  it("hashes deterministically", () => {
    expect(hashString("GeoDex")).toBe(hashString("GeoDex"));
  });

  it("shuffles without losing items", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffle(items, createRng(1)).sort()).toEqual(items);
    expect(shuffle(items, createRng(1))).toEqual(shuffle(items, createRng(1)));
  });

  it("never picks zero-weight items while others have weight", () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      expect(weightedPick(["a", "b"], (x) => (x === "a" ? 0 : 1), rng)).toBe("b");
    }
  });
});
