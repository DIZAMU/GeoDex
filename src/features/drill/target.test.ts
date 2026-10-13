import { describe, expect, it } from "vitest";
import { parseDrillTarget } from "./DrillScreen";

describe("parseDrillTarget", () => {
  it("reads a region", () => {
    expect(parseDrillTarget(new URLSearchParams("region=035"))).toEqual({
      kind: "region",
      subregion: "035",
    });
  });
  it("reads a pair", () => {
    expect(parseDrillTarget(new URLSearchParams("a=SVK&b=SVN"))).toEqual({
      kind: "pair",
      a: "SVK",
      b: "SVN",
    });
  });
  it("rejects a missing or degenerate target", () => {
    expect(parseDrillTarget(new URLSearchParams(""))).toBeNull();
    expect(parseDrillTarget(new URLSearchParams("a=SVK"))).toBeNull();
    expect(parseDrillTarget(new URLSearchParams("a=SVK&b=SVK"))).toBeNull();
  });
});
