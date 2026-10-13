// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTINENTS, type CountriesFile, type Country } from "./types";

const { countries, subregions } = JSON.parse(
  readFileSync("data/countries.json", "utf8"),
) as CountriesFile;
const topology = JSON.parse(readFileSync("data/geo/countries-50m.json", "utf8")) as {
  objects: { countries: { geometries: { id?: string }[] } };
};
const byId = new Map(countries.map((c) => [c.id, c]));
const get = (id: string): Country => {
  const country = byId.get(id);
  if (!country) throw new Error(`Missing ${id}`);
  return country;
};
const defaultScope = countries.filter(
  (c) => c.status === "un_member" || c.status === "un_observer",
);

describe("scope", () => {
  it("has exactly 195 UN members and observers", () => {
    expect(defaultScope).toHaveLength(195);
    expect(countries.filter((c) => c.status === "un_member")).toHaveLength(193);
    expect(
      countries
        .filter((c) => c.status === "un_observer")
        .map((c) => c.id)
        .sort(),
    ).toEqual(["PSE", "VAT"]);
  });

  it("has unique ids and flag keys", () => {
    expect(new Set(countries.map((c) => c.id)).size).toBe(countries.length);
    expect(new Set(countries.map((c) => c.iso2)).size).toBe(countries.length);
  });
});

describe("every country", () => {
  const geometryIds = new Set(topology.objects.countries.geometries.map((g) => g.id));
  const subregionIds = new Set(subregions.map((s) => s.id));

  it.each(countries.map((c) => [c.id, c] as const))("%s is complete", (_, c) => {
    expect(c.names.en.trim()).not.toBe("");
    expect(c.names.nb.trim()).not.toBe("");
    expect(c.officialNames.en.trim()).not.toBe("");
    expect(c.officialNames.nb.trim()).not.toBe("");
    expect(["i", "på"]).toContain(c.prepNb);
    expect(CONTINENTS).toContain(c.continent);
    expect(subregionIds.has(c.subregion)).toBe(true);

    expect(c.capitals.length).toBeGreaterThanOrEqual(1);
    expect(c.capitals.filter((cap) => cap.roles.includes("primary"))).toHaveLength(1);
    for (const capital of c.capitals) {
      expect(capital.names.en).not.toBe("");
      expect(capital.names.nb).not.toBe("");
      expect(Math.abs(capital.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(capital.lon)).toBeLessThanOrEqual(180);
    }

    expect(existsSync(`public/flags/${c.iso2}.svg`)).toBe(true);
    expect(geometryIds.has(c.id) || c.markerOnly).toBe(true);
    expect(geometryIds.has(c.id)).toBe(!c.markerOnly);

    expect(c.currencies.length).toBeGreaterThanOrEqual(1);
    for (const currency of c.currencies) expect(currency.code).toMatch(/^[A-Z]{3}$/);
    expect(c.currencyAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(c.officialLanguages.length).toBeGreaterThanOrEqual(1);

    expect(c.areaKm2).toBeGreaterThan(0);
    expect(c.population).toBeGreaterThan(0);
    expect(c.populationYear).toBeGreaterThanOrEqual(2015);
    expect(c.wikidataId).toMatch(/^Q\d+$/);
  });
});

describe("neighbors", () => {
  it("are symmetric, in scope and never the country itself", () => {
    for (const country of countries) {
      for (const neighbor of country.neighbors) {
        expect(neighbor).not.toBe(country.id);
        expect(get(neighbor).neighbors, `${neighbor} lists ${country.id}`).toContain(country.id);
      }
    }
  });

  it("include well-known land borders", () => {
    expect(get("NOR").neighbors).toEqual(["FIN", "RUS", "SWE"]);
    expect(get("FRA").neighbors).toEqual(expect.arrayContaining(["BRA", "ESP", "DEU", "SUR"]));
    expect(get("LSO").neighbors).toEqual(["ZAF"]);
    expect(get("ISL").neighbors).toEqual([]);
  });
});

describe("capitals with roles", () => {
  const roles = (id: string) =>
    Object.fromEntries(get(id).capitals.map((c) => [c.names.en, c.roles]));

  it("has three capitals for South Africa", () => {
    expect(roles("ZAF")).toEqual({
      Pretoria: ["primary", "executive"],
      "Cape Town": ["legislative"],
      Bloemfontein: ["judicial"],
    });
  });

  it("has Sucre and La Paz for Bolivia", () => {
    expect(roles("BOL")).toEqual({
      Sucre: ["primary", "constitutional", "judicial"],
      "La Paz": ["seat_of_government"],
    });
  });

  it("has Amsterdam and The Hague for the Netherlands", () => {
    expect(roles("NLD")).toEqual({
      Amsterdam: ["primary", "constitutional"],
      "The Hague": ["seat_of_government"],
    });
  });
});

describe("names", () => {
  it.each([
    ["CZE", "Czech Republic"],
    ["TUR", "Turkey"],
    ["SWZ", "Swaziland"],
    ["MMR", "Burma"],
    ["CIV", "Ivory Coast"],
    ["CPV", "Cape Verde"],
    ["TLS", "East Timor"],
    ["MKD", "Macedonia"],
  ])("%s accepts the English alias %s", (id, alias) => {
    expect(get(id).aliases.en).toContain(alias);
  });

  it.each([
    ["DEU", "Tyskland"],
    ["AUT", "Østerrike"],
    ["GBR", "Storbritannia"],
    ["GRC", "Hellas"],
    ["NLD", "Nederland"],
    ["CIV", "Elfenbenskysten"],
  ])("%s is %s in Norwegian", (id, name) => {
    expect(get(id).names.nb).toBe(name);
  });

  it.each([
    ["DNK", "København"],
    ["RUS", "Moskva"],
    ["AUT", "Wien"],
    ["GRC", "Aten"],
  ])("%s has the Norwegian capital name %s", (id, name) => {
    expect(get(id).capitals.map((c) => c.names.nb)).toContain(name);
  });
});

describe("prepNb", () => {
  it.each(["ISL", "CUB", "LKA", "MDG", "MLT", "CYP", "JAM", "PHL"])("%s takes på", (id) => {
    expect(get(id).prepNb).toBe("på");
  });

  it.each(["NOR", "DEU", "LAO", "USA"])("%s takes i", (id) => {
    expect(get(id).prepNb).toBe("i");
  });
});

describe("geography", () => {
  it("has 44 landlocked countries in the default scope", () => {
    expect(defaultScope.filter((c) => c.landlocked)).toHaveLength(44);
  });

  it("maps ISO numeric codes to geometry", () => {
    expect(get("NOR").isoNumeric).toBe("578");
    expect(get("XKX").isoNumeric).toBeNull();
    expect(get("XKX").markerOnly).toBe(false);
  });

  it("keeps centroids on the main landmass", () => {
    const [lon, lat] = get("FRA").centroid;
    expect(lon).toBeGreaterThan(-5);
    expect(lon).toBeLessThan(9);
    expect(lat).toBeGreaterThan(42);
    expect(lat).toBeLessThan(52);
  });
});
