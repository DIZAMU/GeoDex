/** Shared by fetch-landmarks.ts and build-landmarks.ts. */
import type { L10n, L10nList } from "../../../src/data/types.ts";

export type LandmarkSeed = {
  landmarks: string[];
  /** ISO3 overrides where Wikidata lists more than one current country. */
  country: Record<string, string>;
  /** Commons file names overriding Wikidata's P18. */
  image: Record<string, string>;
  names: Record<string, Partial<L10n>>;
  aliases: Record<string, L10nList>;
  /** Authors read from Commons file pages that have no machine-readable author. */
  credit: Record<string, string>;
};

/** The image file per landmark: the seed override, else Wikidata's P18. */
export function landmarkImages(
  seed: LandmarkSeed,
  p18: ReadonlyMap<string, string>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of seed.landmarks) {
    const file = seed.image[id] ?? p18.get(id);
    if (file) out.set(id, file.replace(/ /g, "_"));
  }
  return out;
}

/** Licenses allowed for landmark photos: public domain, CC0, CC BY and CC BY-SA (any version). */
export function allowedLicense(short: string): boolean {
  const s = short.trim().toLowerCase();
  if (s.startsWith("public domain") || /^pd\b/.test(s) || s === "pd") return true;
  if (s.startsWith("cc0")) return true;
  if (/\bnc\b|\bnd\b/.test(s)) return false;
  return /^cc[ -]by(-sa)?( \d(\.\d)?)?/.test(s);
}

/** Plain text from Commons' HTML author field: tags dropped, entities decoded, spaces collapsed. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
