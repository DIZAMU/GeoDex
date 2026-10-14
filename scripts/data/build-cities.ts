/**
 * Builds data/cities.json from the curated city list (data/curated/cities.json), the cities
 * mistaken for capitals (content/confusions.json) and their Wikidata facts in data/raw.
 * Deterministic: same inputs, same bytes. Fails on a city without exactly one current
 * country, or on a listed city that is a national capital.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { CitiesFile, City, CountriesFile, L10n, L10nList } from "../../src/data/types.ts";
import { cityIds } from "./lib/city-list.ts";
import { readRaw } from "./lib/raw.ts";
import {
  type Binding,
  bindings,
  pickStatement,
  point,
  qid,
  rank,
  val,
  year,
} from "./lib/sparql.ts";

type Curated = {
  names: Record<string, L10n>;
  aliases: Record<string, L10nList>;
  formerCapital: string[];
};

const curatedJson = readFileSync("data/curated/cities.json", "utf8");
const curated = JSON.parse(curatedJson) as Curated;
const confusionsJson = readFileSync("content/confusions.json", "utf8");
const ids = cityIds(curatedJson, confusionsJson);
const mistaken = new Set(
  (JSON.parse(confusionsJson) as { confusions: { a: string; dimension: string }[] }).confusions
    .filter((c) => c.dimension === "not_capital")
    .map((c) => c.a),
);
const { countries } = JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile;
const iso3ByQid = new Map(countries.map((c) => [c.wikidataId, c.id]));
const primaryCapitals = new Set(
  countries.flatMap((c) =>
    c.capitals.filter((cap) => cap.roles.includes("primary")).map((cap) => cap.id),
  ),
);

function rows(kind: string): Binding[] {
  return readdirSync("data/raw/wikidata/cities")
    .filter((file) => file.startsWith(`${kind}-`))
    .sort()
    .flatMap((file) => bindings(readRaw(`wikidata/cities/${file}`)));
}

const labels = new Map<string, { en?: string; nb?: string; mul?: string }>();
for (const row of rows("labels")) {
  const id = qid(row, "item") as string;
  const entry = labels.get(id) ?? {};
  entry.en ??= val(row, "en");
  entry.nb ??= val(row, "nb");
  entry.mul ??= val(row, "mul");
  labels.set(id, entry);
}

/** Current countries: statements without an end date; preferred rank wins. */
const countryRows = new Map<string, { iso3: string; preferred: boolean }[]>();
for (const row of rows("country")) {
  const iso3 = iso3ByQid.get(qid(row, "country") ?? "");
  if (!iso3 || val(row, "end") || rank(row) === "deprecated") continue;
  const id = qid(row, "item") as string;
  const list = countryRows.get(id) ?? [];
  if (!list.some((c) => c.iso3 === iso3)) list.push({ iso3, preferred: rank(row) === "preferred" });
  countryRows.set(id, list);
}

const coords = new Map<string, [number, number]>();
for (const row of rows("coord")) {
  const id = qid(row, "item") as string;
  const value = val(row, "coord");
  if (value && !coords.has(id)) coords.set(id, point(value));
}

const populations = new Map<
  string,
  { rank: ReturnType<typeof rank>; time?: number; amount: number }[]
>();
for (const row of rows("population")) {
  const id = qid(row, "item") as string;
  const amount = Number(val(row, "pop"));
  if (!Number.isFinite(amount)) continue;
  populations.set(id, [
    ...(populations.get(id) ?? []),
    { rank: rank(row), time: year(row, "time"), amount },
  ]);
}

/** Former national capitals of the city's current country (P1376 with an end date). */
const formerCapitalOf = new Map<string, Set<string>>();
for (const row of rows("capitalOf")) {
  const iso3 = iso3ByQid.get(qid(row, "of") ?? "");
  if (!iso3 || !val(row, "end")) continue;
  const id = qid(row, "item") as string;
  formerCapitalOf.set(id, (formerCapitalOf.get(id) ?? new Set()).add(iso3));
}

const errors: string[] = [];
const cities: City[] = [];
for (const id of ids) {
  const label = labels.get(id);
  const list = countryRows.get(id) ?? [];
  const preferred = list.filter((c) => c.preferred);
  const pool = preferred.length > 0 ? preferred : list;
  const coord = coords.get(id);
  if (!label || pool.length !== 1 || !coord) {
    errors.push(`${id}: needs a label, one current country and coordinates`);
    continue;
  }
  // A city mistaken for the capital may hold another capital role (Abidjan); others may not.
  if (
    primaryCapitals.has(id) ||
    (!mistaken.has(id) && countries.some((c) => c.capitals.some((cap) => cap.id === id)))
  ) {
    errors.push(`${id} (${label.en}): is a capital`);
    continue;
  }
  const countryId = pool[0]?.iso3 as string;
  const en = curated.names[id]?.en ?? label.en ?? label.mul ?? id;
  const nb = curated.names[id]?.nb ?? label.nb ?? en;
  const pop = pickStatement(populations.get(id) ?? []);
  cities.push({
    id,
    names: { en, nb },
    aliases: curated.aliases[id] ?? { en: [], nb: [] },
    countryId,
    lat: Math.round(coord[1] * 1e4) / 1e4,
    lon: Math.round(coord[0] * 1e4) / 1e4,
    population: pop?.amount ?? 0,
    populationYear: pop?.time ?? null,
    formerCapital:
      (formerCapitalOf.get(id)?.has(countryId) ?? false) || curated.formerCapital.includes(id),
  });
}
if (errors.length > 0) throw new Error(`City build failed:\n${errors.join("\n")}`);

cities.sort((a, b) => a.countryId.localeCompare(b.countryId) || a.id.localeCompare(b.id));
const output: CitiesFile = { cities };
writeFileSync("data/cities.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(`${cities.length} cities written to data/cities.json`);
