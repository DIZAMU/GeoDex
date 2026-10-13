/**
 * Fetches country data from Wikidata into data/raw/wikidata. Cached: existing files are kept
 * unless --refresh is passed. Run with: pnpm data:fetch [--refresh]
 */
import { readFileSync } from "node:fs";
import { fetchText, hasRaw, readRaw, writeRaw } from "./lib/raw.ts";
import { countryQueries, labelQuery } from "./wikidata-queries.ts";

const ENDPOINT = "https://query.wikidata.org/sparql";
const refresh = process.argv.includes("--refresh");

type Scope = { countries: Record<string, { qid: string; status: string }> };
const scope = JSON.parse(readFileSync("data/curated/scope.json", "utf8")) as Scope;
const values = Object.values(scope.countries)
  .map((c) => `wd:${c.qid}`)
  .sort()
  .join(" ");

async function sparql(name: string, query: string): Promise<void> {
  const file = `wikidata/${name}.json`;
  if (hasRaw(file) && !refresh) {
    console.log(`cached  ${file}`);
    return;
  }
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const body = await fetchText(url, { headers: { Accept: "application/sparql-results+json" } });
  writeRaw(file, ENDPOINT, body);
  console.log(`fetched ${file}`);
}

for (const [name, query] of Object.entries(countryQueries(values))) {
  await sparql(name, query);
}

// Labels and aliases for the capitals found above, used for typed answers.
type Bindings = { results: { bindings: Record<string, { value: string }>[] } };
const capitals = JSON.parse(readRaw("wikidata/capitals.json")) as Bindings;
const capitalIds = [
  ...new Set(capitals.results.bindings.map((b) => b.cap?.value.split("/").pop() ?? "")),
]
  .filter(Boolean)
  .sort();
await sparql("capitalLabels", labelQuery(capitalIds.map((id) => `wd:${id}`).join(" ")));
