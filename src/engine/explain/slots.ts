/**
 * Computed slots for templates. Every value is locale-aware text or a raw
 * number/boolean for `when` clauses. Numbers in learner-facing text come only from here.
 */
import { haversineKm } from "../geo.ts";
import type { SlotValue } from "./template.ts";
import type { HookType, Locale } from "./types.ts";

/** The parts of a country the slots read. `Country` from the static data satisfies it. */
export type SlotCountry = {
  id: string;
  names: Record<Locale, string>;
  prepNb: "i" | "på";
  subregion: string;
  neighbors: readonly string[];
  landlocked: boolean;
  areaKm2: number;
  population: number;
  capitals: readonly {
    names: Record<Locale, string>;
    roles: readonly string[];
    lat: number;
    lon: number;
  }[];
  currencies: readonly { code: string; names: Record<Locale, string> }[];
  officialLanguages: readonly { names: Record<Locale, string> }[];
};

export type SlotContext = {
  locale: Locale;
  target: SlotCountry;
  /** The country the learner picked, when wrong (for capital answers, the capital's country). */
  chosen?: SlotCountry | null;
  home?: SlotCountry | null;
  countryById: (id: string) => SlotCountry | undefined;
  subregionName: (id: string) => string;
  /** Highest stability in days over the learner's cards for an entity, 0 if unseen. */
  stability: (entityId: string) => number;
  timesSeen: number;
  lastHookType: HookType | null;
};

/** Every slot path a template may use. The compiler rejects anything else. */
export const KNOWN_SLOTS = [
  "chosen",
  "home",
  "target.name",
  "target.inName",
  "target.subregion",
  "target.capital",
  "target.capitalCount",
  "target.currency",
  "target.language",
  "target.landlocked",
  "target.isHome",
  "target.neighborCount",
  "target.neighborsText",
  "target.knownNeighbor",
  "target.sizeVsHome",
  "target.popVsHome",
  "target.distanceFromHome",
  "target.distanceFromHomeKm",
  "target.directionFromHome",
  "target.distanceFromChosen",
  "target.distanceFromChosenKm",
  "target.directionFromChosen",
  "chosen.name",
  "chosen.inName",
  "chosen.subregion",
  "chosen.capital",
  "chosen.landlocked",
  "chosen.sameSubregion",
  "chosen.isNeighbor",
  "home.name",
  "home.inName",
  "user.timesSeen",
  "user.lastHookType",
] as const;

const COMPASS: Record<Locale, readonly string[]> = {
  en: ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"],
  nb: ["nord", "nordøst", "øst", "sørøst", "sør", "sørvest", "vest", "nordvest"],
};

export function primaryCapital(country: SlotCountry) {
  return country.capitals.find((c) => c.roles.includes("primary")) ?? country.capitals[0];
}

/** "Laos" in English; "i Laos" or "på Island" in Norwegian. */
export function inName(country: SlotCountry, locale: Locale): string {
  return locale === "nb" ? `${country.prepNb} ${country.names.nb}` : `in ${country.names.en}`;
}

/** Initial bearing in degrees from a to b, 0 = north, clockwise. */
export function bearing(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export function compass(degrees: number, locale: Locale): string {
  return COMPASS[locale][Math.round(degrees / 45) % 8] ?? "";
}

function between(from: SlotCountry, to: SlotCountry) {
  const a = primaryCapital(from);
  const b = primaryCapital(to);
  if (!a || !b) return null;
  return {
    km: haversineKm(a.lon, a.lat, b.lon, b.lat),
    degrees: bearing(a.lon, a.lat, b.lon, b.lat),
  };
}

/** Rounded to the nearest 100 km, at least 100: en "8,100 km", nb "8 100 km". */
export function formatDistance(km: number, locale: Locale): string {
  const rounded = Math.max(100, Math.round(km / 100) * 100);
  return `${new Intl.NumberFormat(locale).format(rounded)} km`;
}

function times(ratio: number, locale: Locale): string {
  const digits = ratio < 10 ? 1 : 0;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(ratio);
}

function percent(ratio: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(
    ratio,
  );
}

/** Ratio bands for area: about the same, N times, N percent, under 1 percent. */
export function sizeVsHome(target: SlotCountry, home: SlotCountry, locale: Locale): string {
  const r = target.areaKm2 / home.areaKm2;
  const h = home.names[locale];
  if (locale === "nb") {
    if (r >= 0.85 && r <= 1.15) return `omtrent like stort som ${h}`;
    if (r > 1.15) return `omtrent ${times(r, locale)} ganger så stort som ${h}`;
    if (r >= 0.01) return `omtrent ${percent(r, locale)} av arealet til ${h}`;
    return `under ${percent(0.01, locale)} av arealet til ${h}`;
  }
  if (r >= 0.85 && r <= 1.15) return `about the same size as ${h}`;
  if (r > 1.15) return `about ${times(r, locale)} times the size of ${h}`;
  if (r >= 0.01) return `about ${percent(r, locale)} the size of ${h}`;
  return `under ${percent(0.01, locale)} the size of ${h}`;
}

/** The same bands for population. */
export function popVsHome(target: SlotCountry, home: SlotCountry, locale: Locale): string {
  const r = target.population / home.population;
  const h = home.names[locale];
  if (locale === "nb") {
    const where = inName(home, locale);
    if (r >= 0.85 && r <= 1.15) return `omtrent like mange innbyggere som ${h}`;
    if (r > 1.15) return `omtrent ${times(r, locale)} ganger så mange innbyggere som ${h}`;
    if (r >= 0.01) return `omtrent ${percent(r, locale)} av folketallet ${where}`;
    return `under ${percent(0.01, locale)} av folketallet ${where}`;
  }
  if (r >= 0.85 && r <= 1.15) return `about the same population as ${h}`;
  if (r > 1.15) return `about ${times(r, locale)} times the population of ${h}`;
  if (r >= 0.01) return `about ${percent(r, locale)} of the population of ${h}`;
  return `under ${percent(0.01, locale)} of the population of ${h}`;
}

/** Neighbors the learner knows best first; then the most populous, so the cue is familiar. */
function rankedNeighbors(ctx: SlotContext): SlotCountry[] {
  return ctx.target.neighbors
    .map((id) => ctx.countryById(id))
    .filter((c): c is SlotCountry => c !== undefined)
    .sort(
      (a, b) =>
        ctx.stability(b.id) - ctx.stability(a.id) ||
        b.population - a.population ||
        a.id.localeCompare(b.id),
    );
}

/** Up to 3 names, all of them when there are 4, else "and N others". */
export function neighborsText(ctx: SlotContext): string | null {
  const ranked = rankedNeighbors(ctx);
  if (ranked.length === 0) return null;
  const names = ranked.map((c) => c.names[ctx.locale]);
  const shown = names.length <= 4 ? names : names.slice(0, 3);
  const rest = names.length - shown.length;
  const items =
    rest > 0 ? [...shown, ctx.locale === "nb" ? `${rest} andre` : `${rest} others`] : shown;
  return new Intl.ListFormat(ctx.locale, { type: "conjunction" }).format(items);
}

export function buildSlots(ctx: SlotContext): Record<string, SlotValue> {
  const { locale, target } = ctx;
  const home = ctx.home && ctx.home.id !== target.id ? ctx.home : null;
  const chosen = ctx.chosen && ctx.chosen.id !== target.id ? ctx.chosen : null;
  const ranked = rankedNeighbors(ctx);
  const slots: Record<string, SlotValue> = {
    "target.name": target.names[locale],
    "target.inName": inName(target, locale),
    "target.subregion": ctx.subregionName(target.subregion),
    "target.capital": primaryCapital(target)?.names[locale],
    "target.capitalCount": target.capitals.length,
    "target.currency": target.currencies[0]?.names[locale],
    "target.language": target.officialLanguages[0]?.names[locale],
    "target.landlocked": target.landlocked,
    "target.isHome": ctx.home?.id === target.id,
    "target.neighborCount": target.neighbors.length,
    "target.neighborsText": neighborsText(ctx),
    "target.knownNeighbor": ranked[0]?.names[locale],
    "user.timesSeen": ctx.timesSeen,
    "user.lastHookType": ctx.lastHookType,
  };
  if (home) {
    const d = between(home, target);
    Object.assign(slots, {
      home: true,
      "home.name": home.names[locale],
      "home.inName": inName(home, locale),
      "target.sizeVsHome": sizeVsHome(target, home, locale),
      "target.popVsHome": popVsHome(target, home, locale),
      "target.distanceFromHome": d ? formatDistance(d.km, locale) : null,
      "target.distanceFromHomeKm": d ? Math.round(d.km) : null,
      "target.directionFromHome": d ? compass(d.degrees, locale) : null,
    });
  }
  if (chosen) {
    const d = between(chosen, target);
    Object.assign(slots, {
      chosen: true,
      "chosen.name": chosen.names[locale],
      "chosen.inName": inName(chosen, locale),
      "chosen.subregion": ctx.subregionName(chosen.subregion),
      "chosen.capital": primaryCapital(chosen)?.names[locale],
      "chosen.landlocked": chosen.landlocked,
      "chosen.sameSubregion": chosen.subregion === target.subregion,
      "chosen.isNeighbor": target.neighbors.includes(chosen.id),
      "target.distanceFromChosen": d ? formatDistance(d.km, locale) : null,
      "target.distanceFromChosenKm": d ? Math.round(d.km) : null,
      "target.directionFromChosen": d ? compass(d.degrees, locale) : null,
    });
  }
  return slots;
}
