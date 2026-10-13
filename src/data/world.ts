/** Loads the static world data once, as a separate chunk so the first screen stays light. */
import type { CountriesFile, Country, Subregion } from "./types";

export type FlagMeta = Record<string, { file: string; colors: { color: string; share: number }[] }>;

export type CountryTopology = {
  type: "Topology";
  objects: {
    countries: { type: "GeometryCollection"; geometries: { id?: string; type: string }[] };
    land: unknown;
  };
  arcs: number[][][];
  transform?: { scale: [number, number]; translate: [number, number] };
};

export type WorldData = {
  countries: Country[];
  subregions: Subregion[];
  byId: Map<string, Country>;
  topology: CountryTopology;
  flags: FlagMeta;
};

let pending: Promise<WorldData> | null = null;

export function loadWorld(): Promise<WorldData> {
  pending ??= Promise.all([
    import("../../data/countries.json"),
    import("../../data/geo/countries-50m.json"),
    import("../../data/flags-meta.json"),
  ]).then(([countriesModule, topologyModule, flagsModule]) => {
    const file = countriesModule.default as unknown as CountriesFile;
    return {
      countries: file.countries,
      subregions: file.subregions,
      byId: new Map(file.countries.map((c) => [c.id, c])),
      topology: topologyModule.default as unknown as CountryTopology,
      flags: flagsModule.default as unknown as FlagMeta,
    };
  });
  return pending;
}
