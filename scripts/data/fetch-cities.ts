/**
 * Fetches Wikidata facts for the curated cities (data/curated/cities.json) and every city
 * commonly mistaken for a capital (content/confusions.json) into data/raw. Cached like
 * fetch-wikidata.ts; the file name carries a hash of the QID list, so editing the list
 * fetches again. Run with: pnpm data:fetch [--refresh]
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { cityIds } from "./lib/city-list.ts";
import { fetchText, hasRaw, rawPath, writeRaw } from "./lib/raw.ts";
import { cityQueries } from "./wikidata-queries.ts";

const refresh = process.argv.includes("--refresh");
const ENDPOINT = "https://query.wikidata.org/sparql";

const ids = cityIds(
  readFileSync("data/curated/cities.json", "utf8"),
  readFileSync("content/confusions.json", "utf8"),
);
const hash = createHash("sha256").update(ids.join(" ")).digest("hex").slice(0, 10);
const values = ids.map((id) => `wd:${id}`).join(" ");
const wanted = new Set<string>();
for (const [name, query] of Object.entries(cityQueries(values))) {
  const file = `wikidata/cities/${name}-${hash}.json`;
  wanted.add(file);
  if (hasRaw(file) && !refresh) {
    console.log(`cached  ${file}`);
    continue;
  }
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  writeRaw(file, ENDPOINT, await fetchText(url, { headers: { Accept: "application/sparql-results+json" } }));
  console.log(`fetched ${file}`);
}
// Files from an earlier list are stale.
for (const file of readdirSync(rawPath("wikidata/cities"))) {
  if (!wanted.has(`wikidata/cities/${file}`)) rmSync(rawPath(`wikidata/cities/${file}`));
}
console.log(`${ids.length} cities`);
