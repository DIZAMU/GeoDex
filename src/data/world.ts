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

export type ConfusionPair = { a: string; b: string; dimension: "name" | "flag" | "capital" };

export type WorldData = {
  countries: Country[];
  subregions: Subregion[];
  byId: Map<string, Country>;
  topology: CountryTopology;
  flags: FlagMeta;
  /** Every language in the table, for typed answers and distractors. */
  languageNames: Record<string, { en: string; nb: string }>;
  /** Languages never offered as a wrong answer for a country. */
  excludeAsDistractor: Record<string, string[]>;
  confusionPairs: ConfusionPair[];
};

type LanguagesFile = {
  names: Record<string, { en: string; nb: string }>;
  excludeAsDistractor: Record<string, string[]>;
};

export function assembleWorld(
  file: CountriesFile,
  topology: CountryTopology,
  flags: FlagMeta,
  languages: LanguagesFile,
  pairs: { pairs: ConfusionPair[] },
): WorldData {
  return {
    countries: file.countries,
    subregions: file.subregions,
    byId: new Map(file.countries.map((c) => [c.id, c])),
    topology,
    flags,
    languageNames: languages.names,
    excludeAsDistractor: languages.excludeAsDistractor,
    confusionPairs: pairs.pairs,
  };
}

let pending: Promise<WorldData> | null = null;

export function loadWorld(): Promise<WorldData> {
  pending ??= Promise.all([
    import("../../data/countries.json"),
    import("../../data/geo/countries-50m.json"),
    import("../../data/flags-meta.json"),
    import("../../data/curated/official-languages.json"),
    import("../../data/curated/confusion-pairs.json"),
  ]).then(([countries, topology, flags, languages, pairs]) =>
    assembleWorld(
      countries.default as unknown as CountriesFile,
      topology.default as unknown as CountryTopology,
      flags.default as unknown as FlagMeta,
      languages.default as unknown as LanguagesFile,
      pairs.default as unknown as { pairs: ConfusionPair[] },
    ),
  );
  return pending;
}
