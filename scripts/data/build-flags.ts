/**
 * Copies flag SVGs (flag-icons, 4x3) for every country to public/flags/<iso2>.svg and writes
 * data/flags-meta.json with each flag's dominant named colors. Deterministic.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import type { CountriesFile } from "../../src/data/types.ts";
import { dominantColors, type FlagColorShare } from "./lib/flag-colors.ts";

const SOURCE = "node_modules/flag-icons/flags/4x3";
const TARGET = "public/flags";

const { countries } = JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile;

rmSync(TARGET, { recursive: true, force: true });
mkdirSync(TARGET, { recursive: true });
const available = new Set(readdirSync(SOURCE));

const meta: Record<string, { file: string; colors: FlagColorShare[] }> = {};
for (const country of countries) {
  const file = `${country.iso2}.svg`;
  if (!available.has(file)) throw new Error(`${country.id}: no flag ${file} in flag-icons`);
  copyFileSync(`${SOURCE}/${file}`, `${TARGET}/${file}`);
  const rendered = new Resvg(readFileSync(`${SOURCE}/${file}`), {
    fitTo: { mode: "width", value: 120 },
    font: { loadSystemFonts: false },
  }).render();
  meta[country.id] = { file, colors: dominantColors(new Uint8Array(rendered.pixels)) };
}

writeFileSync("data/flags-meta.json", `${JSON.stringify(meta, null, 2)}\n`);
console.log(`flags: ${Object.keys(meta).length}`);
