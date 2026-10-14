/**
 * Fetches the Natural Earth 1:50m physical layers and Wikidata names for the physical
 * module (data/curated/physical.json) into data/raw. Cached like the other fetches; the
 * Natural Earth files are pinned to a release tag, so they never change under a build.
 * Run with: pnpm data:fetch [--refresh]
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { fetchText, hasRaw, rawPath, writeRaw } from "./lib/raw.ts";
import { labelQuery } from "./wikidata-queries.ts";

const refresh = process.argv.includes("--refresh");
const NE_TAG = "v5.1.2";
export const NE_LAYERS = {
  marine: "ne_50m_geography_marine_polys",
  rivers: "ne_50m_rivers_lake_centerlines",
  lakes: "ne_50m_lakes",
  regions: "ne_50m_geography_regions_polys",
} as const;

async function cached(file: string, url: string, init?: RequestInit): Promise<void> {
  if (hasRaw(file) && !refresh) {
    console.log(`cached  ${file}`);
    return;
  }
  writeRaw(file, url, await fetchText(url, init));
  console.log(`fetched ${file}`);
}

for (const layer of Object.values(NE_LAYERS)) {
  await cached(
    `naturalearth/${layer}.geojson`,
    `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_TAG}/geojson/${layer}.geojson`,
  );
}

const { features } = JSON.parse(readFileSync("data/curated/physical.json", "utf8")) as {
  features: { id: string }[];
};
const ids = features.map((f) => f.id).sort();
const hash = createHash("sha256").update(ids.join(" ")).digest("hex").slice(0, 10);
const file = `wikidata/physical/labels-${hash}.json`;
const ENDPOINT = "https://query.wikidata.org/sparql";
await cached(
  file,
  `${ENDPOINT}?format=json&query=${encodeURIComponent(labelQuery(ids.map((id) => `wd:${id}`).join(" ")))}`,
  { headers: { Accept: "application/sparql-results+json" } },
);
// Labels from an earlier list are stale.
if (existsSync(rawPath("wikidata/physical"))) {
  for (const name of readdirSync(rawPath("wikidata/physical"))) {
    if (`wikidata/physical/${name}` !== file) rmSync(rawPath(`wikidata/physical/${name}`));
  }
}
console.log(`${ids.length} physical features`);
