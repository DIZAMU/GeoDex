/**
 * Builds data/countries.json and data/geo/countries-50m.json from the raw cache (data/raw)
 * and the curated files (data/curated). Deterministic: same inputs, same bytes.
 * Also writes cross-check reports: data/name-mismatches.md, data/neighbor-mismatches.md,
 * data/build-report.md.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type {
  Capital,
  CapitalRole,
  CountriesFile,
  Country,
  CountryStatus,
  L10n,
  L10nList,
  Subregion,
} from "../../src/data/types.ts";
import { CONTINENTS } from "../../src/data/types.ts";
import {
  type CountryTopology,
  featureOf,
  landNeighbors,
  mainShape,
  relabel,
} from "./lib/geometry.ts";
import { continentOf, parseM49 } from "./lib/m49.ts";
import { readManifest, readRaw } from "./lib/raw.ts";
import {
  type Binding,
  bindings,
  pickStatement,
  point,
  qid,
  type Rank,
  rank,
  val,
  year,
} from "./lib/sparql.ts";
import { parseSprakradet } from "./lib/sprakradet.ts";

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

// Curated inputs
type Scope = { countries: Record<string, { qid: string; status: CountryStatus }> };
type CuratedCapitals = { countries: Record<string, { qid: string; roles: CapitalRole[] }[]> };
type CuratedNames = {
  en: Record<string, string>;
  aliases: Record<string, L10nList>;
  capitalNamesNb: Record<string, string>;
  capitalAliases: Record<string, L10nList>;
};
type CuratedCurrencies = {
  countries: Record<string, string[]>;
  names: Record<string, L10n>;
};
type CuratedLanguages = {
  countries: Record<string, string[]>;
  names: Record<string, L10n>;
};
type CuratedSubregions = { nb: Record<string, string>; assign: Record<string, string> };

const scope = readJson<Scope>("data/curated/scope.json").countries;
const curatedCapitals = readJson<CuratedCapitals>("data/curated/capitals.json").countries;
const curatedNames = readJson<CuratedNames>("data/curated/names.json");
const curatedCurrencies = readJson<CuratedCurrencies>("data/curated/currencies.json");
const curatedLanguages = readJson<CuratedLanguages>("data/curated/official-languages.json");
const curatedSubregions = readJson<CuratedSubregions>("data/curated/subregions.json");
const landlocked = new Set(
  readJson<{ countries: string[] }>("data/curated/landlocked.json").countries,
);
const prepPa = new Set(readJson<{ pa: string[] }>("data/curated/prep-nb.json").pa);

const isoByQid = new Map(Object.entries(scope).map(([iso, entry]) => [entry.qid, iso]));
const isos = Object.keys(scope).sort();

function groupByCountry(name: string): Map<string, Binding[]> {
  const groups = new Map<string, Binding[]>();
  for (const binding of bindings(readRaw(`wikidata/${name}.json`))) {
    const iso = isoByQid.get(qid(binding, "item") ?? "");
    if (!iso) continue;
    const list = groups.get(iso) ?? [];
    list.push(binding);
    groups.set(iso, list);
  }
  return groups;
}

const report: string[] = [];
const fail = (message: string): never => {
  throw new Error(message);
};

// Basics: codes and labels
const basics = groupByCountry("basics");
const first = (iso: string, key: string): string | undefined =>
  (basics.get(iso) ?? [])
    .map((b) => val(b, key))
    .filter((v): v is string => v !== undefined)
    .sort()[0];

// UN M49: subregions, continents, fallback codes
const m49 = new Map(parseM49(readRaw("pages/m49.html")).map((row) => [row.iso3, row]));

// Språkrådet: Norwegian names
const sprakradet = parseSprakradet(readRaw("pages/sprakradet-stater.html"));
const nbLabels = new Map<string, Set<string>>();
for (const iso of isos) {
  const labels = new Set<string>();
  const label = first(iso, "nb");
  if (label) labels.add(label.toLowerCase());
  nbLabels.set(iso, labels);
}
for (const binding of bindings(readRaw("wikidata/altLabels.json"))) {
  if (binding.alt?.["xml:lang"] !== "nb") continue;
  const iso = isoByQid.get(qid(binding, "item") ?? "");
  if (iso) nbLabels.get(iso)?.add((val(binding, "alt") ?? "").toLowerCase());
}
const sprakradetByIso = new Map<string, (typeof sprakradet)[number]>();
const unmatchedSprakradet: string[] = [];
for (const entry of sprakradet) {
  const hits = isos.filter((iso) =>
    entry.names.some((name) => nbLabels.get(iso)?.has(name.toLowerCase())),
  );
  if (hits.length === 1 && hits[0]) sprakradetByIso.set(hits[0], entry);
  else unmatchedSprakradet.push(`${entry.names.join(", ")} (${hits.length} matches)`);
}

const nameMismatches: string[] = [];

function uniqueAliases(names: string[], exclude: string): string[] {
  const seen = new Set([exclude.toLowerCase()]);
  const result: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

function countryNames(iso: string): { names: L10n; officialNames: L10n; aliases: L10nList } {
  const wdEn = first(iso, "en") ?? first(iso, "mul") ?? fail(`${iso}: no English label`);
  const wdNb = first(iso, "nb") ?? fail(`${iso}: no Norwegian label`);
  const en = curatedNames.en[iso] ?? wdEn;

  const entry = sprakradetByIso.get(iso);
  let nb = wdNb;
  if (entry && !entry.names.includes(wdNb)) {
    nb = entry.names[0] ?? wdNb;
    nameMismatches.push(`| ${iso} | ${wdNb} | ${entry.names.join(", ")} | ${nb} |`);
  }
  if (!entry) nameMismatches.push(`| ${iso} | ${wdNb} | (not listed) | ${nb} |`);

  const extra = curatedNames.aliases[iso] ?? { en: [], nb: [] };
  const aliases: L10nList = {
    en: uniqueAliases([wdEn, ...extra.en], en),
    nb: uniqueAliases([wdNb, ...(entry?.names ?? []), ...extra.nb], nb),
  };
  const officialNames: L10n = {
    en: (first(iso, "enOfficial") ?? en).replace(/^the /, ""),
    nb: entry?.official || nb,
  };
  return { names: { en, nb }, officialNames, aliases };
}

// Capitals
type CapitalInfo = { en?: string; nb?: string; coord?: [number, number] };
const capitalInfo = new Map<string, CapitalInfo>();
for (const binding of bindings(readRaw("wikidata/capitals.json"))) {
  const id = qid(binding, "cap");
  if (!id) continue;
  const info = capitalInfo.get(id) ?? {};
  info.en ??= val(binding, "en") ?? val(binding, "mul");
  info.nb ??= val(binding, "nb");
  const coord = val(binding, "coord");
  if (coord && !info.coord) info.coord = point(coord);
  capitalInfo.set(id, info);
}
for (const binding of bindings(readRaw("wikidata/capitalLabels.json"))) {
  const id = qid(binding, "item");
  if (!id) continue;
  const info = capitalInfo.get(id) ?? {};
  info.en ??= val(binding, "en") ?? val(binding, "mul");
  info.nb ??= val(binding, "nb");
  capitalInfo.set(id, info);
}
const capitalStatements = groupByCountry("capitals");

function capitalsOf(iso: string): Capital[] {
  let entries: { qid: string; roles: CapitalRole[] }[];
  const curated = curatedCapitals[iso];
  if (curated) {
    entries = curated;
  } else {
    const current = (capitalStatements.get(iso) ?? []).filter(
      (b) => rank(b) !== "deprecated" && !b.end,
    );
    const preferred = current.filter((b) => rank(b) === "preferred");
    const ids = [...new Set((preferred.length ? preferred : current).map((b) => qid(b, "cap")))]
      .filter((id): id is string => id !== undefined)
      .sort();
    if (ids.length !== 1)
      fail(`${iso}: ${ids.length} capitals in Wikidata, add it to capitals.json`);
    entries = [{ qid: ids[0] as string, roles: ["primary"] }];
  }
  return entries.map(({ qid: id, roles }) => {
    const info = capitalInfo.get(id) ?? fail(`${iso}: no data for capital ${id}`);
    const coord = info.coord ?? fail(`${iso}: capital ${id} has no coordinates`);
    const wdEn = info.en ?? fail(`${iso}: capital ${id} has no English label`);
    const wdNb = info.nb ?? wdEn;
    const nb = curatedNames.capitalNamesNb[id] ?? wdNb;
    const extra = curatedNames.capitalAliases[id] ?? { en: [], nb: [] };
    return {
      id,
      names: { en: wdEn, nb },
      aliases: { en: uniqueAliases(extra.en, wdEn), nb: uniqueAliases([wdNb, ...extra.nb], nb) },
      roles,
      lat: Math.round(coord[1] * 1e4) / 1e4,
      lon: Math.round(coord[0] * 1e4) / 1e4,
    };
  });
}

// Area and population
const SQUARE_KM = "Q712226";
const SQUARE_MILE = "Q232291";
const areaStatements = groupByCountry("area");
const populationStatements = groupByCountry("population");

function areaOf(iso: string): number {
  const statements = (areaStatements.get(iso) ?? []).flatMap((b) => {
    const unit = val(b, "unit")?.split("/").pop();
    const amount = Number(val(b, "amount"));
    const km2 = unit === SQUARE_KM ? amount : unit === SQUARE_MILE ? amount * 2.589988 : undefined;
    return km2 === undefined ? [] : [{ rank: rank(b), time: year(b, "time"), amount: km2 }];
  });
  const picked = pickStatement(statements) ?? fail(`${iso}: no area`);
  // Two decimals: the Holy See is 0.44 km².
  return Math.round(picked.amount * 100) / 100;
}

// World Bank population (one consistent year); Wikidata only where the World Bank has none.
type WorldBankRow = { countryiso3code: string; date: string; value: number | null };
const worldBank = new Map(
  (JSON.parse(readRaw("worldbank/population.json")) as [unknown, WorldBankRow[]])[1]
    .filter((row) => row.value !== null)
    .map((row) => [row.countryiso3code, row]),
);
const populationFromWikidata: string[] = [];

function populationOf(iso: string): { population: number; populationYear: number } {
  const row = worldBank.get(iso);
  if (row?.value) return { population: row.value, populationYear: Number(row.date) };
  populationFromWikidata.push(iso);
  const statements = (populationStatements.get(iso) ?? []).map((b) => ({
    rank: rank(b) as Rank,
    time: year(b, "time"),
    amount: Number(val(b, "amount")),
  }));
  const dated = statements.filter((s) => s.time !== undefined);
  const picked = pickStatement(dated) ?? fail(`${iso}: no dated population`);
  return { population: Math.round(picked.amount), populationYear: picked.time ?? 0 };
}

// Geometry
const worldAtlas = readJson<CountryTopology>("node_modules/world-atlas/countries-50m.json");
const isoByNumeric = new Map<string, string>();
const numericOf = new Map<string, string | null>();
for (const iso of isos) {
  const numeric = first(iso, "num") ?? (m49.get(iso)?.m49 || null);
  numericOf.set(iso, numeric);
  if (numeric) isoByNumeric.set(numeric, iso);
}
const featureName = (geometry: { properties?: unknown }): string =>
  (geometry.properties as { name?: string } | undefined)?.name ?? "";
// Features without an ISO numeric id, matched by name.
const GEOMETRY_NAMES: Record<string, string> = { Kosovo: "XKX" };
// Features that reuse a country's numeric id but are separate territories.
const GEOMETRY_EXCLUDED = new Set(["Ashmore and Cartier Is."]);
const { topology, matched } = relabel(worldAtlas, (geometry) => {
  if (GEOMETRY_EXCLUDED.has(featureName(geometry))) return undefined;
  const id = geometry.id === undefined ? undefined : String(geometry.id);
  return (id && isoByNumeric.get(id)) || GEOMETRY_NAMES[featureName(geometry)];
});
const neighborsFromMap = landNeighbors(topology, matched);
// Land borders too short for the 50m geometry: Botswana and Zambia meet for about 150 m at
// Kazungula, on the Zambezi.
const SHORT_BORDERS: [string, string][] = [["BWA", "ZMB"]];
for (const [a, b] of SHORT_BORDERS) {
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    const list = neighborsFromMap.get(from) ?? [];
    if (!list.includes(to)) neighborsFromMap.set(from, [...list, to].sort());
  }
}

// Wikidata P47 cross-check (it also lists maritime borders, so differences are expected)
const wikidataBorders = new Map<string, Set<string>>();
for (const [iso, list] of groupByCountry("borders")) {
  const set = new Set<string>();
  for (const b of list) {
    const other = val(b, "otherIso3");
    if (other && !b.end && scope[other]) set.add(other);
  }
  wikidataBorders.set(iso, set);
}

// Landlocked cross-check
const wikidataLandlocked = new Set(
  bindings(readRaw("wikidata/landlocked.json"))
    .map((b) => isoByQid.get(qid(b, "item") ?? ""))
    .filter((iso): iso is string => iso !== undefined),
);

// Currencies cross-check
const wikidataCurrencies = new Map<string, Set<string>>();
for (const [iso, list] of groupByCountry("currencies")) {
  const codes = list
    .filter((b) => rank(b) !== "deprecated" && !b.end)
    .map((b) => val(b, "code"))
    .filter((code): code is string => code !== undefined && /^[A-Z]{3}$/.test(code));
  wikidataCurrencies.set(iso, new Set(codes));
}

const currencyAsOf = readManifest()["wikidata/currencies.json"]?.fetchedAt ?? fail("No fetch date");

// Kosovo and Taiwan have no M49 row: their continent follows their assigned subregion.
const continentBySubregion = new Map<string, Country["continent"]>();
for (const row of m49.values()) {
  if (!row.regionName) continue; // Antarctica
  continentBySubregion.set(row.subregionCode, continentOf(row.regionName, row.subregionCode));
}

// Assemble
const subregionIds = new Set<string>();
const countries: Country[] = isos.map((iso) => {
  const { qid: wikidataId, status } = scope[iso] ?? fail(`${iso} missing from scope`);
  const m49Row = m49.get(iso);
  const subregion =
    m49Row?.subregionCode ?? curatedSubregions.assign[iso] ?? fail(`${iso}: no subregion`);
  subregionIds.add(subregion);
  const continent = m49Row
    ? continentOf(m49Row.regionName, subregion)
    : (continentBySubregion.get(subregion) ?? fail(`${iso}: continent unknown`));
  const iso2 = (
    first(iso, "iso2") ??
    m49Row?.iso2 ??
    (iso === "XKX" ? "XK" : fail(`${iso}: no iso2`))
  ).toLowerCase();

  const capitals = capitalsOf(iso);
  const primary =
    capitals.find((c) => c.roles.includes("primary")) ?? fail(`${iso}: no primary capital`);
  const index = matched.get(iso);
  let shape: { centroid: [number, number]; bbox: [number, number, number, number] };
  if (index === undefined) {
    const margin = 0.5;
    shape = {
      centroid: [primary.lon, primary.lat],
      bbox: [
        primary.lon - margin,
        primary.lat - margin,
        primary.lon + margin,
        primary.lat + margin,
      ],
    };
  } else {
    shape = mainShape(featureOf(topology, index).geometry);
  }

  const currencyCodes = curatedCurrencies.countries[iso] ?? fail(`${iso}: no currencies`);
  const languageIds = curatedLanguages.countries[iso] ?? fail(`${iso}: no languages`);

  return {
    id: iso,
    iso2,
    isoNumeric: numericOf.get(iso) ?? null,
    ...countryNames(iso),
    prepNb: prepPa.has(iso) ? "på" : "i",
    continent,
    subregion,
    status,
    capitals,
    neighbors: neighborsFromMap.get(iso) ?? [],
    landlocked: landlocked.has(iso),
    areaKm2: areaOf(iso),
    ...populationOf(iso),
    currencies: currencyCodes.map((code) => ({
      code,
      names: curatedCurrencies.names[code] ?? fail(`No names for currency ${code}`),
    })),
    currencyAsOf,
    officialLanguages: languageIds.map((id) => ({
      id,
      names: curatedLanguages.names[id] ?? fail(`No names for language ${id}`),
    })),
    centroid: shape.centroid,
    bbox: shape.bbox,
    markerOnly: index === undefined,
    wikidataId,
  } satisfies Country;
});

const subregions: Subregion[] = [...subregionIds].sort().map((id) => {
  const row = [...m49.values()].find((r) => r.subregionCode === id) ?? fail(`No M49 row for ${id}`);
  return {
    id,
    names: { en: row.subregionName, nb: curatedSubregions.nb[id] ?? fail(`No nb name for ${id}`) },
    continent: continentOf(row.regionName, id),
  };
});
for (const continent of CONTINENTS) {
  if (!subregions.some((s) => s.continent === continent)) fail(`No subregion in ${continent}`);
}

const output: CountriesFile = { subregions, countries };
mkdirSync("data/geo", { recursive: true });
writeFileSync("data/countries.json", `${JSON.stringify(output, null, 2)}\n`);
writeFileSync("data/geo/countries-50m.json", `${JSON.stringify(topology)}\n`);

// Reports
const neighborLines: string[] = [];
for (const iso of isos) {
  const fromMap = new Set(neighborsFromMap.get(iso) ?? []);
  const fromWikidata = wikidataBorders.get(iso) ?? new Set<string>();
  const onlyMap = [...fromMap].filter((x) => !fromWikidata.has(x)).sort();
  const onlyWikidata = [...fromWikidata].filter((x) => !fromMap.has(x)).sort();
  if (onlyMap.length || onlyWikidata.length) {
    neighborLines.push(`| ${iso} | ${onlyMap.join(" ")} | ${onlyWikidata.join(" ")} |`);
  }
}
writeFileSync(
  "data/neighbor-mismatches.md",
  [
    "# Neighbor mismatches",
    "",
    "Generated by `pnpm data:build`. Neighbors come from shared borders in the Natural Earth 50m geometry (world-atlas). Wikidata P47 (shares border with) also lists maritime borders, so most rows in the last column are sea borders and need no action. Rows in the middle column are land borders Wikidata does not list.",
    "",
    "| Country | Map only | Wikidata only |",
    "|---|---|---|",
    ...neighborLines,
    "",
  ].join("\n"),
);

writeFileSync(
  "data/name-mismatches.md",
  [
    "# Norwegian name mismatches",
    "",
    "Generated by `pnpm data:build`. Countries where the Wikidata nb label is not one of the forms Språkrådet accepts, or that Språkrådet does not list. The used name is Språkrådet's preferred form; the Wikidata label becomes an alias.",
    "",
    "| Country | Wikidata nb | Språkrådet | Used |",
    "|---|---|---|---|",
    ...nameMismatches,
    "",
    unmatchedSprakradet.length
      ? `Språkrådet entries not in scope: ${unmatchedSprakradet.join("; ")}.`
      : "Every Språkrådet entry matched a country in scope.",
    "",
  ].join("\n"),
);

const diff = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x)).sort();
report.push(
  "# Data build report",
  "",
  "Generated by `pnpm data:build`. Differences between curated files and Wikidata, for review.",
  "",
  "## Landlocked",
  "",
  `- Curated only: ${diff(landlocked, wikidataLandlocked).join(" ") || "none"}`,
  `- Wikidata only: ${diff(wikidataLandlocked, landlocked).join(" ") || "none"}`,
  "",
  "## Currencies (curated vs Wikidata P38, current statements)",
  "",
);
for (const iso of isos) {
  const curated = new Set(curatedCurrencies.countries[iso] ?? []);
  const wikidata = wikidataCurrencies.get(iso) ?? new Set<string>();
  const added = diff(curated, wikidata);
  const dropped = diff(wikidata, curated);
  if (added.length || dropped.length) {
    report.push(
      `- ${iso}: curated adds ${added.join(" ") || "none"}; drops ${dropped.join(" ") || "none"}`,
    );
  }
}
report.push(
  "",
  "## Population",
  "",
  `- World Bank SP.POP.TOTL for every country except: ${populationFromWikidata.join(" ") || "none"} (Wikidata P1082).`,
  `- English official names missing in Wikidata (P1448), short name used: ${countries.filter((c) => c.officialNames.en === c.names.en).length} countries.`,
  "",
  "## Countries drawn as markers (no 50m geometry)",
  "",
  `- ${
    countries
      .filter((c) => c.markerOnly)
      .map((c) => c.id)
      .join(" ") || "none"
  }`,
  "",
  "## Geometry features not in scope (drawn as land, never asked)",
  "",
  `- ${worldAtlas.objects.countries.geometries
    .filter((_, index) => ![...matched.values()].includes(index))
    .map((g) => featureName(g) || String(g.id))
    .sort()
    .join(", ")}`,
  "",
);
writeFileSync("data/build-report.md", report.join("\n"));

console.log(
  `countries: ${countries.length}, subregions: ${subregions.length}, markers: ${countries.filter((c) => c.markerOnly).length}`,
);
