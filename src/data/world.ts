/** Loads the static world data once, as a separate chunk so the first screen stays light. */
import type {
  CitiesFile,
  City,
  CountriesFile,
  Country,
  CountryGroup,
  GroupsFile,
  HistoricalEntity,
  HistoryFile,
  Landmark,
  LandmarksFile,
  PhysicalFeature,
  PhysicalFile,
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
  /** Landmarks (the landmarks module), by QID. */
  landmarks: Landmark[];
  landmarkById: Map<string, Landmark>;
  /** Oceans, seas, rivers, ranges, deserts and lakes (the physical module), by QID. */
  physical: PhysicalFeature[];
  physicalById: Map<string, PhysicalFeature>;
  /** Former names, dissolved states and empires (the history module), by id. */
  history: HistoricalEntity[];
  historyById: Map<string, HistoricalEntity>;
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
  landmarks: LandmarksFile = { landmarks: [] },
  physical: PhysicalFile = { features: [] },
  history: HistoryFile = { entities: [] },
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
    landmarks: landmarks.landmarks,
    landmarkById: new Map(landmarks.landmarks.map((l) => [l.id, l])),
    physical: physical.features,
    physicalById: new Map(physical.features.map((f) => [f.id, f])),
    history: history.entities,
    historyById: new Map(history.entities.map((e) => [e.id, e])),
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

// The data ships as JSON files, not JavaScript modules: browsers parse JSON several times
// faster than the same data as an object literal, which matters on phones.
import citiesUrl from "../../data/cities.json?url";
import countriesUrl from "../../data/countries.json?url";
import pairsUrl from "../../data/curated/confusion-pairs.json?url";
import groupsUrl from "../../data/curated/groups.json?url";
import languagesUrl from "../../data/curated/official-languages.json?url";
import flagsUrl from "../../data/flags-meta.json?url";
import topologyUrl from "../../data/geo/countries-50m.json?url";
import historyUrl from "../../data/history.json?url";
import landmarksUrl from "../../data/landmarks.json?url";
import physicalUrl from "../../data/physical.json?url";

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  return (await response.json()) as T;
}

export function loadWorld(): Promise<WorldData> {
  pending ??= Promise.all([
    json<CountriesFile>(countriesUrl),
    json<CountryTopology>(topologyUrl),
    json<FlagMeta>(flagsUrl),
    json<LanguagesFile>(languagesUrl),
    json<{ pairs: ConfusionPair[] }>(pairsUrl),
    json<CitiesFile>(citiesUrl),
    json<GroupsFile>(groupsUrl),
    json<LandmarksFile>(landmarksUrl),
    json<PhysicalFile>(physicalUrl),
    json<HistoryFile>(historyUrl),
  ]).then((files) => assembleWorld(...files));
  return pending;
}
