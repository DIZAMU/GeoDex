import { describe, expect, it } from "vitest";
import { allocateNew } from "./modules";

describe("allocateNew", () => {
  it("splits by weight", () => {
    const out = allocateNew(8, [
      { id: "countries", weight: 3, available: 100 },
      { id: "cities", weight: 1, available: 100 },
    ]);
    expect(out.get("countries")).toBe(6);
    expect(out.get("cities")).toBe(2);
  });

  it("passes a short module's share on to the others", () => {
    const out = allocateNew(10, [
      { id: "countries", weight: 3, available: 100 },
      { id: "cities", weight: 1, available: 1 },
    ]);
    expect(out.get("cities")).toBe(1);
    expect(out.get("countries")).toBe(9);
  });

  it("never exceeds what is available or the allowance", () => {
    const out = allocateNew(10, [
      { id: "countries", weight: 3, available: 2 },
      { id: "cities", weight: 1, available: 3 },
    ]);
    expect(out.get("countries")).toBe(2);
    expect(out.get("cities")).toBe(3);
    expect(allocateNew(0, [{ id: "a", weight: 1, available: 5 }]).get("a")).toBe(0);
  });

  it("gives disabled (zero weight) modules nothing and is deterministic on ties", () => {
    const pools = [
      { id: "b", weight: 1, available: 9 },
      { id: "a", weight: 1, available: 9 },
      { id: "off", weight: 0, available: 9 },
    ];
    const out = allocateNew(3, pools);
    expect(out.get("off")).toBe(0);
    expect(out.get("a")).toBe(2);
    expect(out.get("b")).toBe(1);
    expect(allocateNew(3, pools)).toEqual(out);
  });
});
