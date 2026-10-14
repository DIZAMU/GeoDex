// @vitest-environment node
import { readFileSync } from "node:fs";
import { geoArea, geoContains } from "d3-geo";
import type { Feature, MultiPolygon } from "geojson";
import { describe, expect, it } from "vitest";
import type { CountriesFile, HistoryFile } from "./types";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const { entities } = read("data/history.json") as HistoryFile;
const { countries } = read("data/countries.json") as CountriesFile;
const countryIds = new Set(countries.map((c) => c.id));
const withOutline = entities.flatMap((e) => (e.kind === "former_name" ? [] : [e]));

describe("history layer (PLAN.md Phase 9)", () => {
  it("covers each kind in the planned numbers", () => {
    const count = (kind: string) => entities.filter((e) => e.kind === kind).length;
    expect(count("former_name")).toBeGreaterThanOrEqual(25);
    expect(count("dissolved_state")).toBe(8);
    expect(count("empire")).toBeGreaterThanOrEqual(16);
  });

  it("has unique ids not used by any other module", () => {
    const ids = entities.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const others = new Set([
      ...read("data/cities.json").cities.map((c: { id: string }) => c.id),
      ...read("data/landmarks.json").landmarks.map((l: { id: string }) => l.id),
      ...read("data/physical.json").features.map((f: { id: string }) => f.id),
      ...read("data/curated/groups.json").groups.map((g: { id: string }) => g.id),
    ]);
    for (const id of ids) {
      expect(id).toMatch(/^(Q\d+|former-[a-z]+)$/);
      expect(others.has(id), id).toBe(false);
    }
  });

  it("names every entity in both languages and points at known countries", () => {
    for (const e of entities) {
      expect(e.names.en.length, e.id).toBeGreaterThan(2);
      expect(e.names.nb.length, e.id).toBeGreaterThan(2);
      expect(e.countries.length, e.id).toBeGreaterThan(0);
      for (const c of e.countries) expect(countryIds.has(c), `${e.id} ${c}`).toBe(true);
      expect(e.sourceUrl).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/);
    }
  });

  it("gives former names a current country and dissolved states successors", () => {
    for (const e of entities) {
      if (e.kind === "former_name") {
        expect(countryIds.has(e.currentCountry), e.id).toBe(true);
        expect(e.exclude, e.id).not.toContain(e.currentCountry);
      }
      if (e.kind === "dissolved_state") {
        for (const c of e.partly) expect(e.successors, e.id).not.toContain(c);
      }
    }
  });

  it("gives every outline a period, a snapshot year inside it, and a label on it", () => {
    for (const e of withOutline) {
      const [from, to] = e.period;
      expect(from, e.id).toBeLessThan(to);
      expect(e.outline.snapshotYear, e.id).toBeGreaterThanOrEqual(from);
      expect(e.outline.snapshotYear, e.id).toBeLessThanOrEqual(to);
      const shape: Feature<MultiPolygon> = {
        type: "Feature",
        properties: {},
        geometry: e.outline.geometry,
      };
      expect(geoContains(shape, e.outline.label), e.id).toBe(true);
    }
  });

  it("marks every empire approximate", () => {
    for (const e of withOutline) if (e.kind === "empire") expect(e.outline.approximate).toBe(true);
  });

  it("winds every polygon so it covers less than half the globe", () => {
    for (const e of withOutline) {
      for (const poly of e.outline.geometry.coordinates) {
        expect(geoArea({ type: "Polygon", coordinates: poly }), e.id).toBeLessThan(2 * Math.PI);
      }
    }
  });

  it("leaves every empire at least three periods that do not overlap its own", () => {
    const empires = entities.flatMap((e) => (e.kind === "empire" ? [e] : []));
    for (const e of empires) {
      const apart = empires.filter(
        (o) => o.id !== e.id && (o.period[1] < e.period[0] || o.period[0] > e.period[1]),
      );
      expect(apart.length, e.id).toBeGreaterThanOrEqual(3);
    }
  });
});
