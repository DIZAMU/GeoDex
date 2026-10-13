export const LOCALES = ["en", "nb"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Picks nb for any Norwegian browser language (nb, no, nn), en otherwise. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "nb" || base === "no" || base === "nn") return "nb";
    if (base === "en") return "en";
  }
  return "en";
}
