/**
 * Builds data/history.json from data/curated/history.json and the country data.
 * Deterministic and offline. Outlines are either a union of modern countries (merged from
 * the 1:50m topology) or a hand-simplified envelope that the map clips to land or to the
 * listed countries. Each outline gets a label point on land, inside it, and the list of
 * modern countries it covers, which decides when its cards start (DECISIONS.md 037).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance } from "d3-geo";
import type { Feature, Geometry, MultiPolygon, Polygon } from "geojson";
import { merge, feature as topoFeature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type {
  CountriesFile,
  HistoricalEntity,
  HistoryFile,
  HistoryKind,
  HistoryOutline,
  L10n,
  L10nList,
} from "../../src/data/types.ts";
import { type Point, round2, simplifyRing } from "./lib/simplify.ts";

type CuratedOutline = { countries: string[] } | { envelope: Point[][]; clip: "land" | string[] };
type Curated = {
  entities: ({ id: string; kind: HistoryKind; names: L10n; aliases: L10nList } & (
    | { kind: "former_name"; currentCountry: string; until?: number; exclude?: string[] }
    | {
        kind: "dissolved_state";
        period: [number, number];
        snapshotYear: number;
        approximate: boolean;
        successors: string[];
        partly: string[];
        outline: CuratedOutline;
      }
    | {
        kind: "empire";
        period: [number, number];
        snapshotYear: number;
        approximate: boolean;
        outline: CuratedOutline;
      }
  ))[];
};

const curated = JSON.parse(readFileSync("data/curated/history.json", "utf8")) as Curated;
const { countries } = JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile;
const byId = new Map(countries.map((c) => [c.id, c]));
const topology = JSON.parse(readFileSync("data/geo/countries-50m.json", "utf8")) as Topology;
const collection = topology.objects.countries as GeometryCollection;
const shapes = new Map(
  (
    topoFeature(topology, collection as never) as unknown as { features: Feature<Geometry>[] }
  ).features
    .filter((f) => byId.has(String(f.id)))
    .map((f) => [String(f.id), f]),
);

/** Every fourth boundary vertex of each country, for label placement. */
const borders = new Map(
  [...shapes].map(([id, f]) => {
    const g = f.geometry;
    const rings =
      g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [];
    return [id, rings.flatMap((r) => r.filter((_, i) => i % 4 === 0)) as Point[]];
  }),
);

/** d3 reads ring winding: a polygon wound the other way covers the rest of the globe. */
function wound(poly: Point[][]): Point[][] {
  return geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI
    ? poly.map((ring) => [...ring].reverse())
    : poly;
}

function closed(ring: Point[]): Point[] {
  const [a, b] = [ring[0] as Point, ring[ring.length - 1] as Point];
  return a[0] === b[0] && a[1] === b[1] ? ring : [...ring, a];
}

function unionOf(ids: readonly string[]): Point[][][] {
  const wanted = new Set(ids);
  const merged = merge(
    topology,
    collection.geometries.filter((g) => wanted.has(String(g.id))) as never,
  ) as MultiPolygon;
  return merged.coordinates
    .map((poly) =>
      (poly as Point[][])
        .map((ring) => simplifyRing(ring, 0.1))
        .filter((r): r is Point[] => r !== null)
        .map((ring) => ring.map(round2)),
    )
    .filter((poly) => poly.length > 0)
    .map(wound);
}

function inAny(p: Point, ids: readonly string[]): boolean {
  return ids.some((id) => {
    const s = shapes.get(id);
    return s !== undefined && geoContains(s, p);
  });
}

/** Grid point inside the outline and on one of its countries, farthest from the outline edge. */
function labelPoint(parts: Point[][][], on: readonly string[], useBorders: boolean): Point {
  const shape: Feature<Polygon | MultiPolygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: parts },
  };
  const [[w, s], [e, n]] = geoBounds(shape);
  const span = e >= w ? e - w : e + 360 - w;
  // Away from the outline's edge, and from the clip country's border where the outline
  // runs past it on purpose.
  const edge = parts.flat(2).filter((_, i) => i % 2 === 0);
  let best: Point | null = null;
  let bestD = -1;
  const steps = 36;
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      const lon = w + (span * i) / steps;
      const p: Point = [lon > 180 ? lon - 360 : lon, s + ((n - s) * j) / steps];
      if (!geoContains(shape, p)) continue;
      const home = on.find((id) => inAny(p, [id]));
      if (home === undefined) continue;
      const d = Math.min(
        ...edge.map((q) => geoDistance(p, q)),
        ...(useBorders ? (borders.get(home) ?? []) : []).map((q) => geoDistance(p, q)),
      );
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return round2(best ?? (geoCentroid(shape) as Point));
}

/** Most common continent among the countries; ties go to the larger total area. */
function regionOf(ids: readonly string[]): string {
  const score = new Map<string, [number, number]>();
  for (const id of ids) {
    const c = byId.get(id);
    if (!c) continue;
    const [n, a] = score.get(c.continent) ?? [0, 0];
    score.set(c.continent, [n + 1, a + c.areaKm2]);
  }
  const ranked = [...score].sort((x, y) => y[1][0] - x[1][0] || y[1][1] - x[1][1]);
  return ranked[0]?.[0] ?? "europe";
}

function byArea(ids: Iterable<string>): string[] {
  return [...ids].sort(
    (a, b) => (byId.get(b)?.areaKm2 ?? 0) - (byId.get(a)?.areaKm2 ?? 0) || a.localeCompare(b),
  );
}

const errors: string[] = [];

function outlineOf(
  id: string,
  o: CuratedOutline,
  snapshotYear: number,
  approximate: boolean,
): { outline: HistoryOutline; countries: string[] } {
  if ("countries" in o) {
    // Small island states drawn as markers have no shape; they still count for unlocking.
    for (const c of o.countries) if (!byId.has(c)) errors.push(`${id}: unknown country ${c}`);
    const geometry = unionOf(o.countries);
    const largest = [...geometry].sort((a, b) => geoArea(polygon(b)) - geoArea(polygon(a)))[0];
    return {
      outline: {
        geometry: { type: "MultiPolygon", coordinates: geometry },
        clip: null,
        snapshotYear,
        approximate,
        label: labelPoint(largest ? [largest] : geometry, o.countries, false),
      },
      countries: o.countries,
    };
  }
  const parts = o.envelope.map((ring) => wound([closed(ring.map(round2))]));
  const shape: Feature<MultiPolygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: parts },
  };
  const pool = o.clip === "land" ? [...shapes.keys()] : o.clip;
  // A country counts when its centroid lies inside, or when it holds a fair share of the
  // outline's land (Mexico for the Aztecs, though its centroid is far north).
  const hits = new Map<string, number>();
  const [[w, s], [e, n]] = geoBounds(shape);
  for (let i = 1; i < 30; i++) {
    for (let j = 1; j < 30; j++) {
      const p: Point = [w + ((e - w) * i) / 30, s + ((n - s) * j) / 30];
      if (!geoContains(shape, p)) continue;
      const c = pool.find((id) => inAny(p, [id]));
      if (c) hits.set(c, (hits.get(c) ?? 0) + 1);
    }
  }
  const land = [...hits.values()].reduce((a, b) => a + b, 0);
  const covered = pool.filter(
    (c) =>
      o.clip !== "land" ||
      (hits.get(c) ?? 0) >= land * 0.15 ||
      geoContains(shape, geoCentroid(shapes.get(c) as Feature<Geometry>) as Point),
  );
  if (covered.length === 0) errors.push(`${id}: outline covers no country`);
  return {
    outline: {
      geometry: { type: "MultiPolygon", coordinates: parts },
      clip: o.clip,
      snapshotYear,
      approximate,
      label: labelPoint(parts, covered, o.clip !== "land"),
    },
    countries: byArea(covered),
  };
}

function polygon(coordinates: Point[][]): Feature<Polygon> {
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } };
}

const wikidata = (q: string) => `https://www.wikidata.org/wiki/${q}`;
const out: HistoricalEntity[] = [];
for (const e of curated.entities) {
  const base = { id: e.id, names: e.names, aliases: e.aliases };
  if (!e.names.en || !e.names.nb) errors.push(`${e.id}: no name`);
  if (e.kind === "former_name") {
    const country = byId.get(e.currentCountry);
    if (!country) {
      errors.push(`${e.id}: unknown country ${e.currentCountry}`);
      continue;
    }
    out.push({
      ...base,
      kind: "former_name",
      region: country.continent,
      countries: [country.id],
      currentCountry: country.id,
      until: e.until ?? null,
      exclude: e.exclude ?? [],
      sourceUrl: wikidata(e.id.startsWith("Q") ? e.id : country.wikidataId),
    });
    continue;
  }
  const { outline, countries: covered } = outlineOf(e.id, e.outline, e.snapshotYear, e.approximate);
  if (e.kind === "dissolved_state") {
    for (const c of [...e.successors, ...e.partly])
      if (!byId.has(c)) errors.push(`${e.id}: unknown country ${c}`);
    out.push({
      ...base,
      kind: "dissolved_state",
      region: regionOf(e.successors),
      countries: e.successors,
      period: e.period,
      successors: e.successors,
      partly: e.partly,
      outline,
      sourceUrl: wikidata(e.id),
    });
  } else {
    out.push({
      ...base,
      kind: "empire",
      region: regionOf(covered),
      countries: covered,
      period: e.period,
      outline,
      sourceUrl: wikidata(e.id),
    });
  }
}
if (errors.length > 0) throw new Error(`History build failed:\n${errors.join("\n")}`);

const order: HistoryKind[] = ["former_name", "dissolved_state", "empire"];
out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.id.localeCompare(b.id));
const file: HistoryFile = { entities: out };
writeFileSync("data/history.json", `${JSON.stringify(file)}\n`);
console.log(`${out.length} history entities written to data/history.json`);
