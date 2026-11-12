// @vitest-environment node
import { readFileSync } from "node:fs";
import { geoContains, geoDistance } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { describe, expect, it } from "vitest";
import type { CountriesFile, LandmarksFile } from "./types";

const { landmarks } = JSON.parse(readFileSync("data/landmarks.json", "utf8")) as LandmarksFile;
const { countries } = JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile;
const countryById = new Map(countries.map((c) => [c.id, c]));
const topology = JSON.parse(
  readFileSync("data/geo/countries-50m.json", "utf8"),
) as unknown as Topology;
const shapes = new Map(
  (
    feature(topology, topology.objects.countries as never) as unknown as {
      features: Feature<Geometry>[];
    }
  ).features.map((f) => [String(f.id), f]),
);

/** Kilometers from a point to the nearest vertex of a shape (0 when inside it). */
function kmOutside(shape: Feature<Geometry>, point: [number, number]): number {
  if (geoContains(shape, point)) return 0;
  const g = shape.geometry;
  const rings =
    g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [];
  let best = Number.POSITIVE_INFINITY;
  for (const ring of rings)
    for (const p of ring) best = Math.min(best, geoDistance(point, p as [number, number]));
  return best * 6371;
}

describe("landmarks", () => {
  it("are about 120, with at least 10 per inhabited continent", () => {
    expect(landmarks.length).toBeGreaterThanOrEqual(110);
    expect(landmarks.length).toBeLessThanOrEqual(130);
    const perContinent = new Map<string, number>();
    for (const l of landmarks) {
      const continent = countryById.get(l.countryId)?.continent ?? "";
      perContinent.set(continent, (perContinent.get(continent) ?? 0) + 1);
    }
    for (const continent of [
      "africa",
      "asia",
      "europe",
      "north_america",
      "south_america",
      "oceania",
    ]) {
      expect(perContinent.get(continent) ?? 0, continent).toBeGreaterThanOrEqual(10);
    }
  });

  it("have QIDs, names in both languages, and lie in (or just off the coast of) their country", () => {
    for (const l of landmarks) {
      expect(l.id).toMatch(/^Q\d+$/);
      expect(l.names.en.length, l.id).toBeGreaterThan(1);
      expect(l.names.nb.length, l.id).toBeGreaterThan(1);
      const country = countryById.get(l.countryId);
      expect(country, l.id).toBeDefined();
      const shape = shapes.get(l.countryId);
      expect(shape, l.id).toBeDefined();
      // Small islands (Gorée, Robben Island, Liberty Island) can be missing at 50m detail.
      if (shape) expect(kmOutside(shape, [l.lon, l.lat]), l.id).toBeLessThan(40);
    }
  });

  it("each have their own Commons photo under an allowed license, with an author to credit", () => {
    expect(new Set(landmarks.map((l) => l.image.file)).size).toBe(landmarks.length);
    for (const l of landmarks) {
      const { image } = l;
      expect(image.license, l.id).toMatch(
        /^(Public domain|CC0|CC BY(-SA)? \d(\.\d)?( [a-z]{2})?)$/,
      );
      expect(image.author.length, l.id).toBeGreaterThan(1);
      expect(image.sourceUrl, l.id).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(image.url, l.id).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
      expect(image.width, l.id).toBeGreaterThan(0);
      expect(image.height, l.id).toBeGreaterThan(0);
    }
  });
});
