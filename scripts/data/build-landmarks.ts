/**
 * Builds data/landmarks.json from the landmark seed (content/landmarks.seed.json), Wikidata
 * facts and Commons image metadata in data/raw. Deterministic: same inputs, same bytes.
 * Fails on a landmark without exactly one current country in scope, coordinates or an image,
 * and on an image whose license is not allowed (scripts/data/lib/landmarks.ts).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { CountriesFile, Landmark, LandmarksFile } from "../../src/data/types.ts";
import { allowedLicense, type LandmarkSeed, landmarkImages, plainText } from "./lib/landmarks.ts";
import { readRaw } from "./lib/raw.ts";
import { type Binding, bindings, point, qid, rank, val } from "./lib/sparql.ts";

const seed = JSON.parse(readFileSync("content/landmarks.seed.json", "utf8")) as LandmarkSeed;
const { countries } = JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile;
const iso3ByQid = new Map(countries.map((c) => [c.wikidataId, c.id]));
const countryIds = new Set(countries.map((c) => c.id));

function rows(dir: string, kind: string): Binding[] {
  return readdirSync(`data/raw/${dir}`)
    .filter((file) => file.startsWith(`${kind}-`))
    .sort()
    .flatMap((file) => bindings(readRaw(`${dir}/${file}`)));
}

const labels = new Map<string, { en?: string; nb?: string; mul?: string }>();
for (const row of rows("wikidata/landmarks", "labels")) {
  const id = qid(row, "item") as string;
  const entry = labels.get(id) ?? {};
  entry.en ??= val(row, "en");
  entry.nb ??= val(row, "nb");
  entry.mul ??= val(row, "mul");
  labels.set(id, entry);
}

/** Current countries in scope: statements without an end date, not deprecated. */
const countryOf = new Map<string, Set<string>>();
for (const row of rows("wikidata/landmarks", "country")) {
  const iso3 = iso3ByQid.get(qid(row, "country") ?? "");
  if (!iso3 || val(row, "end") || rank(row) === "deprecated") continue;
  const id = qid(row, "item") as string;
  countryOf.set(id, (countryOf.get(id) ?? new Set()).add(iso3));
}

const coords = new Map<string, [number, number]>();
for (const row of rows("wikidata/landmarks", "coord")) {
  const id = qid(row, "item") as string;
  const value = val(row, "coord");
  if (value && !coords.has(id)) coords.set(id, point(value));
}

const p18 = new Map<string, string>();
for (const row of rows("wikidata/landmarks", "image")) {
  const id = qid(row, "item") as string;
  const url = val(row, "image");
  if (url && !p18.has(id)) p18.set(id, decodeURIComponent(url.split("/").pop() ?? ""));
}
const fileOf = landmarkImages(seed, p18);

type ImageInfo = {
  url: string;
  descriptionurl: string;
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  width: number;
  height: number;
  extmetadata?: Record<string, { value: string }>;
};
const infoByFile = new Map<string, ImageInfo>();
for (const file of readdirSync("data/raw/commons/landmarks").sort()) {
  const json = JSON.parse(readRaw(`commons/landmarks/${file}`)) as {
    query?: {
      normalized?: { from: string; to: string }[];
      pages: { title: string; imageinfo?: ImageInfo[] }[];
    };
  };
  for (const page of json.query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    if (info) infoByFile.set(page.title.replace(/^File:/, "").replace(/ /g, "_"), info);
  }
}

const errors: string[] = [];
const landmarks: Landmark[] = [];
for (const id of [...seed.landmarks].sort()) {
  const label = labels.get(id);
  const inScope = [...(countryOf.get(id) ?? [])];
  const countryId = seed.country[id] ?? (inScope.length === 1 ? inScope[0] : undefined);
  const coord = coords.get(id);
  const file = fileOf.get(id);
  const info = file ? infoByFile.get(file) : undefined;
  const name = label?.en ?? id;
  if (!label || !countryId || !countryIds.has(countryId) || !coord) {
    errors.push(`${id} (${name}): needs a label, one current country (${inScope}) and coordinates`);
    continue;
  }
  if (!file || !info) {
    errors.push(`${id} (${name}): no image metadata for ${file ?? "(no P18)"}`);
    continue;
  }
  const meta = info.extmetadata ?? {};
  const license = plainText(meta.LicenseShortName?.value ?? "");
  if (!allowedLicense(license)) {
    errors.push(`${id} (${name}): ${file} has license "${license}", not allowed`);
    continue;
  }
  const author =
    plainText(meta.Artist?.value ?? "") || seed.credit[id] || plainText(meta.Credit?.value ?? "");
  if (!author && !license.toLowerCase().startsWith("public domain")) {
    errors.push(`${id} (${name}): ${file} has no author to credit`);
    continue;
  }
  const en = seed.names[id]?.en ?? label.en ?? label.mul ?? id;
  const nb = seed.names[id]?.nb ?? label.nb ?? en;
  landmarks.push({
    id,
    names: { en, nb },
    aliases: seed.aliases[id] ?? { en: [], nb: [] },
    countryId,
    lat: Math.round(coord[1] * 1e4) / 1e4,
    lon: Math.round(coord[0] * 1e4) / 1e4,
    image: {
      file: file.replace(/_/g, " "),
      author: author || "Unknown author",
      license,
      licenseUrl: meta.LicenseUrl?.value ?? null,
      sourceUrl: info.descriptionurl,
      // Commons appends tracking parameters to rendition URLs; the plain path serves the same file.
      url: (info.thumburl ?? info.url).split("?")[0] as string,
      width: info.thumbwidth ?? info.width,
      height: info.thumbheight ?? info.height,
    },
  });
}
if (errors.length > 0) throw new Error(`Landmark build failed:\n${errors.join("\n")}`);

landmarks.sort((a, b) => a.countryId.localeCompare(b.countryId) || a.id.localeCompare(b.id));
const output: LandmarksFile = { landmarks };
writeFileSync("data/landmarks.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(`${landmarks.length} landmarks written to data/landmarks.json`);
