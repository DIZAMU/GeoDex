// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CountriesFile, GroupsFile } from "./types";
import { resolveGroups } from "./world";

const file = JSON.parse(readFileSync("data/curated/groups.json", "utf8")) as GroupsFile;
const { countries, subregions } = JSON.parse(
  readFileSync("data/countries.json", "utf8"),
) as CountriesFile;
const groups = resolveGroups(file, countries);
const countryIds = new Set(countries.map((c) => c.id));

describe("country groups", () => {
  it("have unique QIDs and names in both languages", () => {
    expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length);
    for (const g of groups) {
      expect(g.id).toMatch(/^Q\d+$/);
      expect(g.names.en.length, g.id).toBeGreaterThan(1);
      expect(g.names.nb.length, g.id).toBeGreaterThan(1);
      expect(g.phrase.en.length, g.id).toBeGreaterThan(1);
      expect(g.phrase.nb.length, g.id).toBeGreaterThan(1);
    }
    for (const locale of ["en", "nb"] as const) {
      const names = groups.map((g) => g.names[locale].toLowerCase());
      expect(new Set(names).size, locale).toBe(names.length);
    }
  });

  it("list known countries, at least two each, never both core and sometimes", () => {
    for (const g of groups) {
      expect(g.members.length, g.id).toBeGreaterThanOrEqual(2);
      for (const id of [...g.members, ...g.sometimes]) expect(countryIds.has(id), id).toBe(true);
      expect(
        g.members.filter((id) => g.sometimes.includes(id)),
        g.id,
      ).toEqual([]);
    }
  });

  it("differ from each other, so a highlighted group has one right name", () => {
    const keys = groups.map((g) => [...g.members].sort().join(" "));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("use the app's names for UN subregions", () => {
    for (const g of groups.filter((x) => x.m49)) {
      const sub = subregions.find((s) => s.id === g.m49);
      expect(sub?.names, g.id).toEqual(g.names);
    }
  });

  it("include the groups the author asked for", () => {
    const en = new Set(groups.map((g) => g.names.en));
    for (const name of ["Scandinavia", "Caribbean", "Nordic countries", "Baltic states", "Balkans"])
      expect(en.has(name), name).toBe(true);
    expect(groups.find((g) => g.names.en === "Scandinavia")?.members).toEqual([
      "DNK",
      "NOR",
      "SWE",
    ]);
    expect(groups.find((g) => g.names.en === "Caribbean")?.members).toHaveLength(13);
  });
});
