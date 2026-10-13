import { geoArea, geoBounds, geoCentroid } from "d3-geo";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { feature, neighbors } from "topojson-client";
import type { GeometryCollection, GeometryObject, Topology } from "topojson-specification";

export type CountryTopology = Topology<{
  countries: GeometryCollection<{ name: string }>;
  land: GeometryCollection;
}>;

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor || 0;
};

/** Centroid and bbox of the largest polygon, so overseas parts do not pull them away. */
export function mainShape(geometry: Polygon | MultiPolygon): {
  centroid: [number, number];
  bbox: [number, number, number, number];
} {
  const polygons: Polygon[] =
    geometry.type === "Polygon"
      ? [geometry]
      : geometry.coordinates.map((coordinates) => ({ type: "Polygon", coordinates }));
  let largest = polygons[0];
  let largestArea = -1;
  for (const polygon of polygons) {
    const area = geoArea(polygon);
    if (area > largestArea) {
      largest = polygon;
      largestArea = area;
    }
  }
  if (!largest) throw new Error("Geometry without polygons");
  const [cx, cy] = geoCentroid(largest);
  const [[west, south], [east, north]] = geoBounds(largest);
  return {
    centroid: [round(cx, 3), round(cy, 3)],
    bbox: [round(west, 3), round(south, 3), round(east, 3), round(north, 3)],
  };
}

/**
 * Rewrites geometry ids to ISO3 for the given id map and drops properties of matched
 * features. Unmatched features keep their original id and name and draw as plain land.
 */
export function relabel(
  topology: CountryTopology,
  idFor: (geometry: GeometryObject<{ name: string }>) => string | undefined,
): { topology: CountryTopology; matched: Map<string, number> } {
  const matched = new Map<string, number>();
  const geometries = topology.objects.countries.geometries.map((geometry, index) => {
    const iso3 = idFor(geometry);
    if (!iso3) return geometry;
    if (matched.has(iso3)) throw new Error(`Two geometries map to ${iso3}`);
    matched.set(iso3, index);
    const { properties: _properties, ...rest } = geometry;
    return { ...rest, id: iso3 };
  });
  return {
    topology: {
      ...topology,
      objects: {
        ...topology.objects,
        countries: { ...topology.objects.countries, geometries },
      },
    },
    matched,
  };
}

/** Land neighbors between matched features, from shared arcs. Sorted and symmetric. */
export function landNeighbors(
  topology: CountryTopology,
  matched: Map<string, number>,
): Map<string, string[]> {
  const isoByIndex = new Map([...matched].map(([iso, index]) => [index, iso]));
  const adjacency = neighbors(topology.objects.countries.geometries);
  const result = new Map<string, string[]>();
  for (const [iso, index] of matched) {
    const list = (adjacency[index] ?? [])
      .map((other) => isoByIndex.get(other))
      .filter((other): other is string => other !== undefined && other !== iso);
    result.set(iso, [...new Set(list)].sort());
  }
  return result;
}

export function featureOf(
  topology: CountryTopology,
  index: number,
): Feature<Polygon | MultiPolygon> {
  const geometry = topology.objects.countries.geometries[index];
  if (!geometry) throw new Error(`No geometry at ${index}`);
  return feature(topology, geometry) as Feature<Polygon | MultiPolygon>;
}
