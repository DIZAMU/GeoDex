/**
 * Fetches reference sources: Språkrådet's list of Norwegian state names, the UN M49 regions
 * table, and World Bank population (SP.POP.TOTL, latest year). Cached like fetch-wikidata.ts.
 */
import { fetchText, hasRaw, writeRaw } from "./lib/raw.ts";

const refresh = process.argv.includes("--refresh");

const PAGES: Record<string, string> = {
  "pages/sprakradet-stater.html":
    "https://sprakradet.no/stedsnavn-og-navn-pa-statsorgan/navnelister-norsk-skrivemate/utanlandske-stadnamn-navn-pa-stater-og-sprak-transkripsjon/navn-pa-stater/",
  "pages/m49.html": "https://unstats.un.org/unsd/methodology/m49/overview/",
  "worldbank/population.json":
    "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=400",
};

for (const [name, url] of Object.entries(PAGES)) {
  if (hasRaw(name) && !refresh) {
    console.log(`cached  ${name}`);
    continue;
  }
  writeRaw(name, url, await fetchText(url));
  console.log(`fetched ${name}`);
}
