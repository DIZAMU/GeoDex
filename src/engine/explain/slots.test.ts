// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CountriesFile, Country } from "@/data/types";
import {
  buildSlots,
  compass,
  formatDistance,
  inName,
  popVsHome,
  type SlotContext,
  sizeVsHome,
} from "./slots";

const data = JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile;
const byId = new Map(data.countries.map((c) => [c.id, c]));
const get = (id: string) => byId.get(id) as Country;
const subregions = new Map(data.subregions.map((s) => [s.id, s.names]));

function ctx(target: string, overrides: Partial<SlotContext> = {}): SlotContext {
  return {
    locale: "en",
    target: get(target),
    home: get("NOR"),
    countryById: (id) => byId.get(id),
    subregionName: (id) => subregions.get(id)?.en ?? id,
    stability: () => 0,
    timesSeen: 0,
    lastHookType: null,
    ...overrides,
  };
}

describe("slots", () => {
  it("compares size and population with home at the extremes", () => {
    expect(sizeVsHome(get("MCO"), get("NOR"), "en")).toBe("under 1% the size of Norway");
    expect(sizeVsHome(get("MCO"), get("NOR"), "nb").replace(/\s/g, " ")).toBe(
      "under 1 % av arealet til Norge",
    );
    expect(sizeVsHome(get("RUS"), get("NOR"), "en")).toMatch(
      /^about \d+ times the size of Norway$/,
    );
    expect(sizeVsHome(get("DNK"), get("NOR"), "en")).toMatch(/^about \d+% the size of Norway$/);
    expect(sizeVsHome(get("NOR"), get("NOR"), "en")).toBe("about the same size as Norway");
    expect(popVsHome(get("ISL"), get("NOR"), "nb")).toMatch(
      /^omtrent \d+\s% av folketallet i Norge$/,
    );
    expect(popVsHome(get("NOR"), get("ISL"), "nb")).toMatch(/av folketallet|ganger så mange/);
    expect(popVsHome(get("MCO"), get("ISL"), "nb")).toMatch(/av folketallet på Island$/);
  });

  it("uses prepNb for Norwegian place phrases", () => {
    expect(inName(get("ISL"), "nb")).toBe("på Island");
    expect(inName(get("CUB"), "nb")).toBe("på Cuba");
    expect(inName(get("LAO"), "nb")).toBe("i Laos");
    expect(inName(get("LAO"), "en")).toBe("in Laos");
  });

  it("formats distances per locale and rounds to 100 km", () => {
    expect(formatDistance(8149, "en")).toBe("8,100 km");
    expect(formatDistance(8149, "nb").replace(/\s/g, " ")).toBe("8 100 km");
    expect(formatDistance(12, "en")).toBe("100 km");
    expect(compass(0, "en")).toBe("north");
    expect(compass(135, "nb")).toBe("sørøst");
    expect(compass(350, "en")).toBe("north");
  });

  it("drops home comparisons when the target is home", () => {
    const slots = buildSlots(ctx("NOR"));
    expect(slots["target.isHome"]).toBe(true);
    expect(slots.home).toBeUndefined();
    expect(slots["target.sizeVsHome"]).toBeUndefined();
  });

  it("names neighbors, preferring ones the learner knows", () => {
    const known = buildSlots(ctx("AUT", { stability: (id) => (id === "LIE" ? 30 : 0) }));
    expect(known["target.knownNeighbor"]).toBe("Liechtenstein");
    expect(known["target.neighborsText"]).toMatch(/^Liechtenstein, Germany, Italy, and 5 others$/);
    expect(buildSlots(ctx("ISL"))["target.neighborsText"]).toBeNull();
    const nb = buildSlots(ctx("ESP", { locale: "nb" }))["target.neighborsText"];
    expect(nb).toMatch(/ og /);
  });

  it("describes the wrong pick relative to the target", () => {
    const slots = buildSlots(ctx("SVN", { chosen: get("SVK") }));
    expect(slots.chosen).toBe(true);
    expect(slots["chosen.sameSubregion"]).toBe(false);
    expect(slots["target.directionFromChosen"]).toBe("southwest");
    expect(slots["chosen.isNeighbor"]).toBe(false);
  });
});
