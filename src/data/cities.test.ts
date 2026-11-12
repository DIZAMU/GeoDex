// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CitiesFile, CountriesFile } from "./types";

const { cities } = JSON.parse(readFileSync("data/cities.json", "utf8")) as CitiesFile;
const { countries } = JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile;
const { confusions } = JSON.parse(readFileSync("content/confusions.json", "utf8")) as {
  confusions: { a: string; b: string; dimension: string }[];
};
const byId = new Map(cities.map((c) => [c.id, c]));
const countryById = new Map(countries.map((c) => [c.id, c]));

describe("cities", () => {
  it("stay a short list of world-famous cities (docs/DECISIONS.md 033)", () => {
    expect(cities.length).toBeGreaterThanOrEqual(30);
    expect(cities.length).toBeLessThanOrEqual(50);
  });

  it("have QIDs, names in both languages, a country and plausible coordinates", () => {
    for (const c of cities) {
      expect(c.id).toMatch(/^Q\d+$/);
      expect(c.names.en.length, c.id).toBeGreaterThan(1);
      expect(c.names.nb.length, c.id).toBeGreaterThan(1);
      expect(countryById.has(c.countryId), c.id).toBe(true);
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lon)).toBeLessThanOrEqual(180);
      expect(c.population, c.id).toBeGreaterThan(100_000);
    }
  });

  it("are never a primary national capital", () => {
    const primary = new Set(
      countries.flatMap((c) =>
        c.capitals.filter((cap) => cap.roles.includes("primary")).map((cap) => cap.id),
      ),
    );
    for (const c of cities) expect(primary.has(c.id), c.names.en).toBe(false);
  });

  it("lie within about 2,000 km of their country's main landmass", () => {
    for (const c of cities) {
      const [west, south, east, north] = countryById.get(c.countryId)?.bbox ?? [0, 0, 0, 0];
      const inLat = c.lat >= south - 20 && c.lat <= north + 20;
      const inLon =
        west > east
          ? c.lon >= west - 20 || c.lon <= east + 20
          : c.lon >= west - 20 && c.lon <= east + 20;
      expect(inLat && inLon, c.names.en).toBe(true);
    }
  });

  it("include every city mistaken for a capital, in the country of that capital", () => {
    const pairs = confusions.filter((c) => c.dimension === "not_capital");
    expect(pairs.length).toBeGreaterThanOrEqual(17);
    for (const pair of pairs) {
      const city = byId.get(pair.a);
      expect(city, pair.a).toBeDefined();
      const country = countryById.get(city?.countryId ?? "");
      const capital = country?.capitals.find((cap) => cap.id === pair.b);
      expect(
        capital,
        `${city?.names.en}: ${pair.b} is not a capital of ${country?.id}`,
      ).toBeDefined();
      expect(capital?.roles).toContain("primary");
    }
  });
});
