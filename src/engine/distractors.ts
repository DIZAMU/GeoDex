/** Multiple choice distractors (PLAN.md 6.5). */
import { type Rng, shuffle } from "./random";

/** What the engine needs to know about a country to pick look-alikes. */
export type CountryFacts = {
  id: string;
  subregion: string;
  continent: string;
  flagColors: readonly string[];
  currencies: readonly string[];
  languages: readonly string[];
  /** Languages never offered as a wrong answer for this country (ambiguous status). */
  languagesNotDistractors?: readonly string[];
};

export type DistractorOptions = {
  count: number;
  rng: Rng;
  /** Countries the learner confused with the target, most confused first. */
  userConfusions?: readonly string[];
  /** Curated look-alikes for this card's dimension. */
  curatedConfusions?: readonly string[];
  /** Random far-away distractors are allowed only before a card's first review. */
  firstReview: boolean;
  /** Rank by flag color similarity within each tier (flag cards). */
  byFlag?: boolean;
  exclude?: ReadonlySet<string>;
};

/** Share of colors two flags have in common (Jaccard). */
export function flagSimilarity(a: readonly string[], b: readonly string[]): number {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return a.filter((color) => b.includes(color)).length / union.size;
}

/** Takes items tier by tier until `count` are picked. Tiers are already ordered. */
function takeFromTiers(tiers: readonly (readonly string[])[], count: number): string[] {
  const picked: string[] = [];
  for (const tier of tiers) {
    for (const id of tier) {
      if (picked.length >= count) return picked;
      if (!picked.includes(id)) picked.push(id);
    }
  }
  return picked;
}

/** Distractor countries for a country answer (names, map, flags, capitals). */
export function countryDistractors(
  target: CountryFacts,
  countries: readonly CountryFacts[],
  options: DistractorOptions,
): string[] {
  const pool = countries.filter((c) => c.id !== target.id && !options.exclude?.has(c.id));
  const ids = new Set(pool.map((c) => c.id));
  const order = (list: readonly CountryFacts[]) => {
    const shuffled = shuffle(list, options.rng);
    if (!options.byFlag) return shuffled.map((c) => c.id);
    return shuffled
      .map((c) => ({ id: c.id, score: flagSimilarity(target.flagColors, c.flagColors) }))
      .sort((a, b) => b.score - a.score)
      .map((c) => c.id);
  };
  const tiers = [
    (options.userConfusions ?? []).filter((id) => ids.has(id)),
    shuffle(
      (options.curatedConfusions ?? []).filter((id) => ids.has(id)),
      options.rng,
    ),
    order(pool.filter((c) => c.subregion === target.subregion)),
    order(pool.filter((c) => c.continent === target.continent)),
  ];
  if (options.firstReview) tiers.push(order(pool));
  const picked = takeFromTiers(tiers, options.count);
  // Never return fewer options than asked: fall back to anywhere if the continent is too small.
  return picked.length < options.count
    ? takeFromTiers([...tiers, order(pool)], options.count)
    : picked;
}

/** Wrong currencies for a country: never one it uses, preferring its neighbors' currencies. */
export function currencyDistractors(
  target: CountryFacts,
  countries: readonly CountryFacts[],
  count: number,
  rng: Rng,
): string[] {
  const own = new Set(target.currencies);
  const from = (list: readonly CountryFacts[]) =>
    shuffle(
      [...new Set(list.flatMap((c) => c.currencies))].filter((code) => !own.has(code)),
      rng,
    );
  return takeFromTiers(
    [
      from(countries.filter((c) => c.subregion === target.subregion)),
      from(countries.filter((c) => c.continent === target.continent)),
      from(countries),
    ],
    count,
  );
}

/**
 * Wrong languages for "Which is an official language of X?": never an official language
 * of X and never one of its excluded languages; prefers languages of nearby countries.
 */
export function languageDistractors(
  target: CountryFacts,
  countries: readonly CountryFacts[],
  count: number,
  rng: Rng,
): string[] {
  const blocked = new Set([...target.languages, ...(target.languagesNotDistractors ?? [])]);
  const from = (list: readonly CountryFacts[]) =>
    shuffle(
      [...new Set(list.flatMap((c) => c.languages))].filter((id) => !blocked.has(id)),
      rng,
    );
  return takeFromTiers(
    [
      from(countries.filter((c) => c.subregion === target.subregion)),
      from(countries.filter((c) => c.continent === target.continent)),
      from(countries),
    ],
    count,
  );
}
