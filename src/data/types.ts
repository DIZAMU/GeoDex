/**
 * Static data types, shared by the build scripts (scripts/data) and the app.
 * See PLAN.md 5.1. Generated files in data/ conform to these types.
 */

export type Locale = "en" | "nb";
export type L10n = Record<Locale, string>;
export type L10nList = Record<Locale, string[]>;

export const CONTINENTS = [
  "africa",
  "asia",
  "europe",
  "north_america",
  "south_america",
  "oceania",
] as const;
export type Continent = (typeof CONTINENTS)[number];

export type CapitalRole =
  | "primary"
  | "executive"
  | "legislative"
  | "judicial"
  | "constitutional"
  | "seat_of_government";

export type CountryStatus = "un_member" | "un_observer" | "partially_recognized" | "territory";

export type Capital = {
  id: string; // Wikidata QID
  names: L10n;
  aliases: L10nList;
  /** Every role this city holds. Exactly one capital per country includes "primary". */
  roles: CapitalRole[];
  lat: number;
  lon: number;
};

export type Currency = { code: string; names: L10n };
export type OfficialLanguage = { id: string; names: L10n };

export type Country = {
  id: string; // ISO 3166-1 alpha-3. Kosovo: "XKX"
  iso2: string; // flag file key, lowercase
  isoNumeric: string | null; // ISO 3166-1 numeric, null for Kosovo
  names: L10n;
  officialNames: L10n;
  aliases: L10nList;
  prepNb: "i" | "på";
  continent: Continent;
  subregion: string; // UN M49 code of the subregion
  status: CountryStatus;
  capitals: Capital[];
  neighbors: string[]; // ISO3, land borders, sorted
  landlocked: boolean;
  areaKm2: number;
  population: number;
  populationYear: number;
  currencies: Currency[]; // ISO 4217
  currencyAsOf: string; // YYYY-MM-DD of the source fetch
  officialLanguages: OfficialLanguage[];
  /** [lon, lat] of the largest polygon, or of the marker for countries without geometry. */
  centroid: [number, number];
  /** [west, south, east, north] of the largest polygon. west > east when it crosses 180°. */
  bbox: [number, number, number, number];
  /** True when the map draws this country as a point marker instead of a shape. */
  markerOnly: boolean;
  wikidataId: string;
};

export type Subregion = {
  id: string; // UN M49 code
  names: L10n;
  continent: Continent;
};

export type CountriesFile = {
  subregions: Subregion[];
  countries: Country[];
};

/** A city outside the capitals (PLAN.md 5.1). Built by scripts/data/build-cities.ts. */
export type City = {
  id: string; // Wikidata QID
  names: L10n;
  aliases: L10nList;
  countryId: string; // ISO3
  lat: number;
  lon: number;
  population: number;
  populationYear: number | null;
  /** Was once the national capital of its current country (Lagos, Almaty, Rio de Janeiro). */
  formerCapital: boolean;
};

export type CitiesFile = { cities: City[] };

/**
 * A named group of countries: a region (Scandinavia, the Balkans), an organization (EU,
 * NATO) or a UN M49 subregion. See data/curated/groups.json.
 */
export type GroupKind = "region" | "organization" | "un_subregion";

type GroupBase = {
  id: string; // Wikidata QID
  kind: GroupKind;
  names: L10n;
  aliases: L10nList;
  /** Completes "Which of these is ...?": "in the Balkans", "a member of NATO". */
  phrase: L10n;
};

/** As written in data/curated/groups.json: a UN subregion names its M49 code instead. */
export type GroupSource = GroupBase &
  ({ m49: string } | { members: string[]; sometimes: string[] });

export type GroupsFile = { groups: GroupSource[] };

export type CountryGroup = GroupBase & {
  /** ISO3 of the countries every common definition includes. */
  members: string[];
  /** ISO3 of countries only some definitions include: never asked, never a wrong answer. */
  sometimes: string[];
  m49: string | null;
};

/** A Commons photo with what its license requires us to show (PLAN.md 3). */
export type LandmarkImage = {
  /** Commons file name, without "File:". */
  file: string;
  /** Plain-text author as Commons credits it. */
  author: string;
  /** Short license name: "CC BY-SA 4.0", "Public domain". */
  license: string;
  licenseUrl: string | null;
  /** The file's Commons page. */
  sourceUrl: string;
  /** A 960 px wide rendition on upload.wikimedia.org. */
  url: string;
  width: number;
  height: number;
};

export type Landmark = {
  id: string; // Wikidata QID
  names: L10n;
  aliases: L10nList;
  countryId: string; // ISO3
  lat: number;
  lon: number;
  image: LandmarkImage;
};

export type LandmarksFile = { landmarks: Landmark[] };

/** Physical geography (PLAN.md Phase 8). */
export type PhysicalKind = "ocean" | "sea" | "river" | "mountain_range" | "desert" | "lake";

export type PhysicalFeature = {
  id: string; // Wikidata QID
  kind: PhysicalKind;
  /** Content group and card order: a continent id, or "ocean". */
  region: string;
  names: L10n;
  aliases: L10nList;
  /** ISO3 of the countries it crosses or borders, most first. */
  countries: string[];
  /** [lon, lat] for the label, inside the shape (on the line for rivers). */
  label: [number, number];
  geometry:
    | { type: "MultiPolygon"; coordinates: [number, number][][][] }
    | { type: "MultiLineString"; coordinates: [number, number][][] };
};

export type PhysicalFile = { features: PhysicalFeature[] };

export type HistoryKind = "former_name" | "dissolved_state" | "empire";

type HistoryBase = {
  /** Wikidata QID, or `former-<name>` for a renamed state with no item of its own. */
  id: string;
  names: L10n;
  aliases: L10nList;
  /** Content group and card order: a continent id. */
  region: string;
  /** ISO3 of the modern countries it covered or became, most first. Decides when cards start. */
  countries: string[];
  sourceUrl: string;
};

/** Drawn as `geometry`, clipped to land or to the union of the listed countries. */
export type HistoryOutline = {
  geometry: { type: "MultiPolygon"; coordinates: [number, number][][][] };
  clip: "land" | string[] | null;
  /** Year the outline shows. */
  snapshotYear: number;
  approximate: boolean;
  /** [lon, lat] for the label. */
  label: [number, number];
};

export type FormerName = HistoryBase & {
  kind: "former_name";
  currentCountry: string;
  /** Last year the name was official, where that is one clear year. */
  until: number | null;
  /** Countries never offered as a wrong answer (Greece for Macedonia). */
  exclude: string[];
};

export type DissolvedState = HistoryBase & {
  kind: "dissolved_state";
  /** Years; negative is BCE. */
  period: [number, number];
  /** Countries wholly or mostly inside it. */
  successors: string[];
  /** Countries partly inside it: never asked, never a wrong answer. */
  partly: string[];
  outline: HistoryOutline;
};

export type Empire = HistoryBase & {
  kind: "empire";
  period: [number, number];
  outline: HistoryOutline;
};

export type HistoricalEntity = FormerName | DissolvedState | Empire;

export type HistoryFile = { entities: HistoricalEntity[] };
