// @vitest-environment node
import { readFileSync } from "node:fs";
import { geoContains, geoDistance } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { describe, expect, it } from "vitest";
import type { CountriesFile, PhysicalFile } from "./types";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const { features } = read("data/physical.json") as PhysicalFile;
const { countries } = read("data/countries.json") as CountriesFile;
const countryIds = new Set(countries.map((c) => c.id));

describe("physical features (PLAN.md Phase 8)", () => {
  it("cover each kind in the planned numbers", () => {
    const count = (kind: string) => features.filter((f) => f.kind === kind).length;
    expect(count("ocean")).toBe(5);
    expect(count("sea")).toBeGreaterThanOrEqual(15);
    expect(count("river")).toBeGreaterThanOrEqual(20);
    expect(count("mountain_range")).toBeGreaterThanOrEqual(12);
    expect(count("desert")).toBeGreaterThanOrEqual(8);
    expect(count("lake")).toBeGreaterThanOrEqual(8);
  });

  it("have unique QIDs not used by any other module", () => {
    const ids = features.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const others = new Set([
      ...read("data/cities.json").cities.map((c: { id: string }) => c.id),
      ...read("data/landmarks.json").landmarks.map((l: { id: string }) => l.id),
      ...read("data/curated/groups.json").groups.map((g: { id: string }) => g.id),
    ]);
    for (const id of ids) {
      expect(id).toMatch(/^Q\d+$/);
      expect(others.has(id), id).toBe(false);
    }
  });

  it("have names in both languages and known countries", () => {
    for (const f of features) {
      expect(f.names.en.length, f.id).toBeGreaterThan(1);
      expect(f.names.nb.length, f.id).toBeGreaterThan(1);
      for (const c of f.countries) expect(countryIds.has(c), `${f.id} ${c}`).toBe(true);
      if (f.kind !== "ocean") expect(f.countries.length, f.id).toBeGreaterThan(0);
    }
  });

  it("place every label on the feature: inside a shape, on a river", () => {
    for (const f of features) {
      if (f.geometry.type === "MultiPolygon") {
        const shape: Feature<Geometry> = { type: "Feature", properties: {}, geometry: f.geometry };
        expect(geoContains(shape, f.label), f.id).toBe(true);
      } else {
        const near = Math.min(
          ...f.geometry.coordinates.flat().map((p) => geoDistance(p, f.label) * 6371),
        );
        expect(near, f.id).toBeLessThan(1);
      }
    }
  });
});
