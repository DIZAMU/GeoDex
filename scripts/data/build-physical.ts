/**
 * Builds data/physical.json from the curated list (data/curated/physical.json), Natural
 * Earth 1:50m layers and Wikidata names in data/raw. Deterministic. For each feature:
 * merged and simplified geometry, a label point inside it, and the countries it touches
 * (rivers and land regions: countries they cross; water: countries on its shore).
 * Fails on a feature with no geometry, no names, or no country.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { geoArea, geoBounds, geoContains, geoDistance } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { feature as topoFeature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type {
  CountriesFile,
  L10n,
  L10nList,
  PhysicalFeature,
  PhysicalFile,
  PhysicalKind,
} from "../../src/data/types.ts";
import { readRaw } from "./lib/raw.ts";
import {
  lineLength,
  midpoint,
  type Point,
  round2,
  simplifyLine,
  simplifyRing,
} from "./lib/simplify.ts";
import { bindings, qid, val } from "./lib/sparql.ts";

type Curated = {
  features: {
    id: string;
    kind: PhysicalKind;
    region: string;
    source: "marine" | "rivers" | "lakes" | "regions";
    segments?: string[];
  }[];
  names: Record<string, Partial<L10n>>;
  aliases: Record<string, L10nList>;
};

const curated = JSON.parse(readFileSync("data/curated/physical.json", "utf8")) as Curated;
const LAYERS = {
  marine: "ne_50m_geography_marine_polys",
  rivers: "ne_50m_rivers_lake_centerlines",
  lakes: "ne_50m_lakes",
  regions: "ne_50m_geography_regions_polys",
} as const;
type NeFeature = Feature<Geometry, Record<string, unknown>>;
const layers = Object.fromEntries(
  Object.entries(LAYERS).map(([key, name]) => [
    key,
    (JSON.parse(readRaw(`naturalearth/${name}.geojson`)) as { features: NeFeature[] }).features,
  ]),
) as Record<keyof typeof LAYERS, NeFeature[]>;

/** Property lookup that ignores case: the regions layer uses upper-case keys. */
function prop(f: NeFeature, key: string): unknown {
  const props = f.properties ?? {};
  return props[key] ?? props[key.toUpperCase()];
}

const labels = new Map<string, { en?: string; nb?: string; mul?: string }>();
const labelFile = readdirSync("data/raw/wikidata/physical").sort()[0] as string;
for (const row of bindings(readRaw(`wikidata/physical/${labelFile}`))) {
  const id = qid(row, "item") as string;
  const entry = labels.get(id) ?? {};
  entry.en ??= val(row, "en");
  entry.nb ??= val(row, "nb");
  entry.mul ??= val(row, "mul");
  labels.set(id, entry);
}

const { countries } = JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile;
const topology = JSON.parse(readFileSync("data/geo/countries-50m.json", "utf8")) as Topology;
const countryShapes = (
  topoFeature(topology, topology.objects.countries as never) as unknown as {
    features: Feature<Geometry>[];
  }
).features
  .filter((f) => countries.some((c) => c.id === String(f.id)))
  .map((f) => {
    const [[w, s], [e, n]] = geoBounds(f);
    const g = f.geometry;
    const rings =
      g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [];
    // Every fourth boundary vertex is plenty for a shore test at 50m detail.
    const coast = rings.flatMap((r) => r.filter((_, i) => i % 4 === 0)) as Point[];
    return { id: String(f.id), shape: f, bbox: [w, s, e, n] as const, coast };
  });

const TOLERANCE: Record<PhysicalKind, number> = {
  ocean: 0.2,
  sea: 0.05,
  lake: 0.02,
  river: 0.02,
  mountain_range: 0.05,
  desert: 0.05,
};
const SHORE_KM = 60;
const RAD = 6371;

function inBox(p: Point, box: readonly [number, number, number, number], pad: number): boolean {
  const [w, s, e, n] = box;
  if (p[1] < s - pad || p[1] > n + pad) return false;
  return w <= e ? p[0] >= w - pad && p[0] <= e + pad : p[0] >= w - pad || p[0] <= e + pad;
}

/** Countries a set of points falls in, most hits first. */
function countriesContaining(points: readonly Point[]): Map<string, number> {
  const hits = new Map<string, number>();
  for (const p of points) {
    for (const c of countryShapes) {
      if (inBox(p, c.bbox, 0) && geoContains(c.shape, p)) hits.set(c.id, (hits.get(c.id) ?? 0) + 1);
    }
  }
  return hits;
}

/** Countries with a coast within SHORE_KM of any of the points, most hits first. */
function countriesNear(points: readonly Point[]): Map<string, number> {
  const hits = new Map<string, number>();
  const pad = SHORE_KM / 111 + 0.5;
  for (const p of points) {
    for (const c of countryShapes) {
      if (!inBox(p, c.bbox, pad)) continue;
      if (c.coast.some((q) => geoDistance(p, q) * RAD < SHORE_KM))
        hits.set(c.id, (hits.get(c.id) ?? 0) + 1);
    }
  }
  return hits;
}

function ranked(hits: Map<string, number>): string[] {
  return [...hits].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id);
}

/** A point well inside a polygon: the grid point farthest from its boundary. */
function interiorPoint(poly: Point[][]): Point {
  const outer = poly[0] as Point[];
  const xs = outer.map((p) => p[0]);
  const ys = outer.map((p) => p[1]);
  const [w, e, s, n] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const shape: Feature<Geometry> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: poly },
  };
  const boundary = poly.flat();
  let best: Point = outer[0] as Point;
  let bestD = -1;
  const steps = 40;
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      const p: Point = [w + ((e - w) * i) / steps, s + ((n - s) * j) / steps];
      if (!geoContains(shape, p)) continue;
      const d = Math.min(...boundary.map((q) => geoDistance(p, q)));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return round2(best);
}

function polygonArea(ring: readonly Point[]): number {
  let a = 0;
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i - 1] as Point;
    const q = ring[i] as Point;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
}

const errors: string[] = [];
const out: PhysicalFeature[] = [];
for (const c of curated.features) {
  const label = labels.get(c.id);
  const en = curated.names[c.id]?.en ?? label?.en ?? label?.mul;
  const nb = curated.names[c.id]?.nb ?? label?.nb ?? en;
  if (!en || !nb) {
    errors.push(`${c.id}: no name`);
    continue;
  }
  const tolerance = TOLERANCE[c.kind];
  let geometry: PhysicalFeature["geometry"];
  let labelPoint: Point;
  let touches: string[];
  if (c.source === "rivers") {
    const wanted = new Set(c.segments ?? []);
    const lines = layers.rivers
      .filter((f) => wanted.has(String(prop(f, "name"))) && f.geometry)
      .flatMap((f) =>
        f.geometry.type === "LineString"
          ? [f.geometry.coordinates as Point[]]
          : f.geometry.type === "MultiLineString"
            ? (f.geometry.coordinates as Point[][])
            : [],
      )
      .map((l) => simplifyLine(l, tolerance).map(round2))
      .filter((l) => l.length >= 2);
    const found = new Set(
      layers.rivers
        .filter((f) => wanted.has(String(prop(f, "name"))))
        .map((f) => String(prop(f, "name"))),
    );
    for (const name of wanted)
      if (!found.has(name)) errors.push(`${c.id}: no river segment "${name}"`);
    geometry = { type: "MultiLineString", coordinates: lines };
    const longest = [...lines].sort((a, b) => lineLength(b) - lineLength(a))[0] ?? [];
    labelPoint = round2(midpoint(longest));
    touches = ranked(countriesContaining(lines.flat()));
  } else {
    const parts = layers[c.source]
      .filter((f) => prop(f, "wikidataid") === c.id && f.geometry)
      .flatMap((f) =>
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates as Point[][]]
          : f.geometry.type === "MultiPolygon"
            ? (f.geometry.coordinates as Point[][][])
            : [],
      )
      .map((poly) =>
        poly.map((ring) => simplifyRing(ring, tolerance)).filter((r): r is Point[] => r !== null),
      )
      .filter((poly) => poly.length > 0)
      .map((poly) => poly.map((ring) => ring.map(round2)))
      // d3 reads ring winding: a part wound the other way would cover the rest of the globe.
      .map((poly) =>
        geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI
          ? poly.map((ring) => [...ring].reverse())
          : poly,
      );
    geometry = { type: "MultiPolygon", coordinates: parts };
    const largest = [...parts].sort((a, b) => polygonArea(b[0] ?? []) - polygonArea(a[0] ?? []))[0];
    labelPoint = largest ? interiorPoint(largest) : [0, 0];
    const boundary = parts.flatMap((poly) => poly.flat());
    const inside = countriesContaining([...boundary.filter((_, i) => i % 2 === 0), labelPoint]);
    if (c.kind === "lake") {
      // A lake can lie wholly inside one country, far from any border.
      for (const [id, n] of countriesNear(boundary.filter((_, i) => i % 3 === 0)))
        inside.set(id, (inside.get(id) ?? 0) + n);
    }
    touches =
      c.kind === "mountain_range" || c.kind === "desert" || c.kind === "lake"
        ? ranked(inside)
        : ranked(countriesNear(boundary.filter((_, i) => i % 3 === 0)));
  }
  if (geometry.coordinates.length === 0) {
    errors.push(`${c.id} (${en}): no geometry`);
    continue;
  }
  // The Southern Ocean borders no country in scope; oceans start with any country.
  if (touches.length === 0 && c.kind !== "ocean") {
    errors.push(`${c.id} (${en}): touches no country`);
    continue;
  }
  out.push({
    id: c.id,
    kind: c.kind,
    region: c.region,
    names: { en, nb },
    aliases: curated.aliases[c.id] ?? { en: [], nb: [] },
    countries: touches,
    label: labelPoint,
    geometry,
  });
}
if (errors.length > 0) throw new Error(`Physical build failed:\n${errors.join("\n")}`);

const order: PhysicalKind[] = ["ocean", "sea", "lake", "river", "mountain_range", "desert"];
out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.id.localeCompare(b.id));
const file: PhysicalFile = { features: out };
writeFileSync("data/physical.json", `${JSON.stringify(file)}\n`);
console.log(`${out.length} physical features written to data/physical.json`);
