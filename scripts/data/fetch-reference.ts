/**
 * Fetches reference pages used to cross-check Wikidata: Språkrådet's list of Norwegian state
 * names and the UN M49 regions table. Cached like fetch-wikidata.ts.
 */
import { fetchText, hasRaw, writeRaw } from "./raw-cache.ts";

const refresh = process.argv.includes("--refresh");

const PAGES: Record<string, string> = {
  "pages/sprakradet-stater.html":
    "https://sprakradet.no/stedsnavn-og-navn-pa-statsorgan/navnelister-norsk-skrivemate/utanlandske-stadnamn-navn-pa-stater-og-sprak-transkripsjon/navn-pa-stater/",
  "pages/m49.html": "https://unstats.un.org/unsd/methodology/m49/overview/",
};

for (const [name, url] of Object.entries(PAGES)) {
  if (hasRaw(name) && !refresh) {
    console.log(`cached  ${name}`);
    continue;
  }
  writeRaw(name, url, await fetchText(url));
  console.log(`fetched ${name}`);
}
