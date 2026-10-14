/**
 * Fetches Wikidata facts for the landmark seed (content/landmarks.seed.json) and the Commons
 * license metadata of each landmark's image into data/raw. Cached like fetch-cities.ts: file
 * names carry a hash of their inputs, so editing the seed fetches again. Commons is asked in
 * batches of 50 titles, one request at a time. Run with: pnpm data:fetch [--refresh]
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { type LandmarkSeed, landmarkImages } from "./lib/landmarks.ts";
import { fetchText, hasRaw, rawPath, readRaw, writeRaw } from "./lib/raw.ts";
import { bindings, qid, val } from "./lib/sparql.ts";
import { landmarkQueries } from "./wikidata-queries.ts";

const refresh = process.argv.includes("--refresh");
const ENDPOINT = "https://query.wikidata.org/sparql";
const COMMONS = "https://commons.wikimedia.org/w/api.php";

const seed = JSON.parse(readFileSync("content/landmarks.seed.json", "utf8")) as LandmarkSeed;
const ids = [...seed.landmarks].sort();
const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 10);
const values = ids.map((id) => `wd:${id}`).join(" ");
const wanted = new Set<string>();

async function cached(file: string, url: string, init?: RequestInit): Promise<void> {
  wanted.add(file);
  if (hasRaw(file) && !refresh) {
    console.log(`cached  ${file}`);
    return;
  }
  writeRaw(file, url, await fetchText(url, init));
  console.log(`fetched ${file}`);
}

const idHash = hash(ids.join(" "));
for (const [name, query] of Object.entries(landmarkQueries(values))) {
  await cached(
    `wikidata/landmarks/${name}-${idHash}.json`,
    `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/sparql-results+json" } },
  );
}

// Image files: Wikidata's P18 unless the seed overrides it.
const p18 = new Map<string, string>();
for (const row of bindings(readRaw(`wikidata/landmarks/image-${idHash}.json`))) {
  const id = qid(row, "item") as string;
  const url = val(row, "image");
  if (url && !p18.has(id)) p18.set(id, decodeURIComponent(url.split("/").pop() ?? ""));
}
const files = [...new Set(landmarkImages(seed, p18).values())].sort();
for (let i = 0; i < files.length; i += 50) {
  const batch = files.slice(i, i + 50);
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "960",
    iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|Credit|AttributionRequired",
    titles: batch.map((f) => `File:${f}`).join("|"),
    maxlag: "5",
  });
  await cached(`commons/landmarks/${hash(batch.join("|"))}.json`, `${COMMONS}?${params}`);
}

// Files from an earlier seed are stale.
for (const dir of ["wikidata/landmarks", "commons/landmarks"]) {
  if (!existsSync(rawPath(dir))) continue;
  for (const file of readdirSync(rawPath(dir))) {
    if (!wanted.has(`${dir}/${file}`)) rmSync(rawPath(`${dir}/${file}`));
  }
}
console.log(`${ids.length} landmarks, ${files.length} images`);
