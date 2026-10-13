import { tableRows } from "./html.ts";

/** One state in Språkrådet's list, Bokmål forms only. */
export type SprakradetEntry = {
  /** Accepted Bokmål short names, the preferred form first. */
  names: string[];
  /** Official Bokmål name. */
  official: string;
};

/**
 * Expands Språkrådet's notation into plain name variants:
 * - "Elfenbe(i)nskysten": optional letters inside a word give both spellings, shorter first.
 * - "Saint (St.) Lucia": a parenthesis after a word is an alternative for that word.
 * - "(Føderasjonen) Saint Kitts": a leading parenthesis is optional.
 * - "Myanmar el. Burma": alternatives.
 */
export function expandVariants(raw: string): string[] {
  const results: string[] = [];
  for (const alternative of raw.split(/\s+el\.\s+/)) {
    let forms = [alternative.trim()];
    // Leading optional words: "(Føderasjonen) Saint Kitts".
    forms = forms.flatMap((form) => {
      const lead = form.match(/^\(([^)]+)\)\s+(.*)$/);
      return lead ? [lead[2] ?? "", `${lead[1]} ${lead[2]}`] : [form];
    });
    // Alternative for the previous word: "Saint (St.) Lucia".
    forms = forms.flatMap((form) => {
      const alt = form.match(/^(.*?)(\S+) \(([^)]+)\)(.*)$/);
      return alt ? [`${alt[1]}${alt[2]}${alt[4]}`, `${alt[1]}${alt[3]}${alt[4]}`] : [form];
    });
    // Optional letters inside a word: "Elfenbe(i)nskysten".
    forms = forms.flatMap((form) => {
      const optional = form.match(/^(.*\S)\(([^)\s]+)\)(\S.*)$/);
      return optional
        ? [`${optional[1]}${optional[3]}`, `${optional[1]}${optional[2]}${optional[3]}`]
        : [form];
    });
    results.push(...forms.map((form) => form.replace(/\s+/g, " ").trim()));
  }
  return [...new Set(results.filter(Boolean))];
}

/** Bokmål form of "bokmål/nynorsk" or "bokmål / nynorsk". */
function bokmal(text: string): string {
  return (text.split(/\s*\/\s*/)[0] ?? "").trim();
}

export function parseSprakradet(html: string): SprakradetEntry[] {
  const start = html.indexOf("Offisielt navn");
  if (start < 0) throw new Error("Språkrådet page layout changed: no 'Offisielt navn' header");
  const entries: SprakradetEntry[] = [];
  for (const cells of tableRows(html.slice(start))) {
    const [short, official] = cells;
    if (!short || official === undefined || short === "Kortnavn") continue;
    if (short.includes("(nyn.)")) continue;
    const shortBm = bokmal(
      short
        .replace(/\s*\(bm\.\)\s*/, " ")
        .replace(/^\*/, "")
        .trim(),
    );
    const names = expandVariants(shortBm);
    const officialBm =
      official === "" || official.startsWith("også offisielt navn")
        ? (names[0] ?? "")
        : (expandVariants(bokmal(official))[0] ?? "");
    entries.push({ names, official: officialBm });
  }
  return entries;
}
