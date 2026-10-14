/** Loads the static world data once, as a separate chunk so the first screen stays light. */
import type {
  CitiesFile,
  City,
  CountriesFile,
  Country,
  CountryGroup,
  GroupsFile,
  Subregion,
} from "./types";

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
  /** Famous cities (the cities module), by QID. */
  cities: City[];
  cityById: Map<string, City>;
  /** Groups of countries (the groups module), by QID. */
  groups: CountryGroup[];
  groupById: Map<string, CountryGroup>;
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
  cities: CitiesFile = { cities: [] },
  groupsFile: GroupsFile = { groups: [] },
): WorldData {
  const groups = resolveGroups(groupsFile, file.countries);
  return {
    countries: file.countries,
    subregions: file.subregions,
    byId: new Map(file.countries.map((c) => [c.id, c])),
    topology,
    flags,
    languageNames: languages.names,
    excludeAsDistractor: languages.excludeAsDistractor,
    confusionPairs: pairs.pairs,
    cities: cities.cities,
    cityById: new Map(cities.cities.map((c) => [c.id, c])),
    groups,
    groupById: new Map(groups.map((g) => [g.id, g])),
  };
}

/** UN subregion groups take their members from the country data. */
export function resolveGroups(file: GroupsFile, countries: readonly Country[]): CountryGroup[] {
  return file.groups.map((g) => {
    const { names, aliases, phrase, id, kind } = g;
    if ("m49" in g) {
      const members = countries.filter((c) => c.subregion === g.m49).map((c) => c.id);
      return { id, kind, names, aliases, phrase, members, sometimes: [], m49: g.m49 };
    }
    return {
      id,
      kind,
      names,
      aliases,
      phrase,
      members: g.members,
      sometimes: g.sometimes,
      m49: null,
    };
  });
}

let pending: Promise<WorldData> | null = null;

export function loadWorld(): Promise<WorldData> {
  pending ??= Promise.all([
    import("../../data/countries.json"),
    import("../../data/geo/countries-50m.json"),
    import("../../data/flags-meta.json"),
    import("../../data/curated/official-languages.json"),
    import("../../data/curated/confusion-pairs.json"),
    import("../../data/cities.json"),
    import("../../data/curated/groups.json"),
  ]).then(([countries, topology, flags, languages, pairs, cities, groups]) =>
    assembleWorld(
      countries.default as unknown as CountriesFile,
      topology.default as unknown as CountryTopology,
      flags.default as unknown as FlagMeta,
      languages.default as unknown as LanguagesFile,
      pairs.default as unknown as { pairs: ConfusionPair[] },
      cities.default as unknown as CitiesFile,
      groups.default as unknown as GroupsFile,
    ),
  );
  return pending;
}
