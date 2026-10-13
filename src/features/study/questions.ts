/**
 * Turns a card into a concrete question: what to show, how to answer, and how to check it
 * (PLAN.md 5.3, 5.4). Pure: same inputs, same question.
 */
import type { Country } from "@/data/types";
import type { WorldData } from "@/data/world";
import {
  type CountryFacts,
  countryDistractors,
  currencyDistractors,
  languageDistractors,
} from "@/engine/distractors";
import { type Answerable, buildIndex, matchAnswer } from "@/engine/matching";
import { createRng, shuffle } from "@/engine/random";
import type { CardState } from "@/engine/scheduler";
import {
  type AnswerMode,
  type CountryCardType,
  type InputSetting,
  parseCardId,
} from "@/engine/types";
import type { Locale } from "@/i18n/locales";

export type MapView = { kind: "world" } | { kind: "countries"; ids: string[] };

export type Prompt =
  | { kind: "map"; countryId: string; view: MapView }
  | { kind: "name"; countryId: string }
  | { kind: "flag"; countryId: string }
  | { kind: "capital"; countryId: string; capitalId: string };

export type Option = { id: string; label: string; flag?: string };

export type AnswerFormat =
  | { kind: "choice"; options: Option[] }
  | { kind: "flags"; options: Option[] }
  | { kind: "typed" }
  | { kind: "map"; view: MapView };

export type AnswerKind = "country" | "capital" | "currency" | "language";

export type Question = {
  cardId: string;
  entityId: string;
  type: CountryCardType;
  prompt: Prompt;
  answer: AnswerFormat;
  answerKind: AnswerKind;
  /** Ids that count as correct: the country, any of its capitals, currencies or languages. */
  correctIds: string[];
  mode: AnswerMode;
};

export type StudyContext = {
  world: WorldData;
  locale: Locale;
  facts: Map<string, CountryFacts>;
  /** Learner confusions per country, most confused first. */
  confusionsFor: (countryId: string) => string[];
  /** Curated look-alikes per country for a dimension. */
  curatedFor: (countryId: string, dimension: "name" | "flag" | "capital") => string[];
  indexes: Indexes;
};

/** Typed-answer indexes, built once per world. */
export type Indexes = Record<AnswerKind, ReturnType<typeof buildIndex>>;

export function buildIndexes(
  world: WorldData,
  languageNames: Record<string, { en: string; nb: string }>,
): Indexes {
  const countries: Answerable[] = world.countries.map((c) => ({
    id: c.id,
    names: [c.names.en, c.names.nb, ...c.aliases.en, ...c.aliases.nb],
  }));
  const capitals: Answerable[] = world.countries.flatMap((c) =>
    c.capitals.map((cap) => ({
      id: cap.id,
      names: [cap.names.en, cap.names.nb, ...cap.aliases.en, ...cap.aliases.nb],
    })),
  );
  const currencyNames = new Map<string, Set<string>>();
  for (const c of world.countries) {
    for (const cur of c.currencies) {
      const set = currencyNames.get(cur.code) ?? new Set([cur.code]);
      set.add(cur.names.en);
      set.add(cur.names.nb);
      currencyNames.set(cur.code, set);
    }
  }
  const currencies: Answerable[] = [...currencyNames].map(([id, names]) => ({
    id,
    names: [...names],
  }));
  const languages: Answerable[] = Object.entries(languageNames).map(([id, n]) => ({
    id,
    names: [n.en, n.nb],
  }));
  return {
    country: buildIndex(countries),
    capital: buildIndex(capitals),
    currency: buildIndex(currencies),
    language: buildIndex(languages),
  };
}

const TEXT_ANSWER: Partial<Record<CountryCardType, AnswerKind>> = {
  map_to_name: "country",
  country_to_capital: "capital",
  capital_to_country: "country",
  flag_to_name: "country",
  country_to_currency: "currency",
  country_to_language: "language",
};

/** Stability band for answer escalation (PLAN.md 5.4). */
export function band(state: CardState | undefined): "new" | "middle" | "strong" {
  if (!state || state.phase === "new" || state.stability < 2) return "new";
  return state.stability <= 14 ? "middle" : "strong";
}

export function mapView(
  country: Country,
  countries: readonly Country[],
  level: "subregion" | "continent" | "world",
): MapView {
  if (level === "world") return { kind: "world" };
  const ids = countries
    .filter((c) =>
      level === "subregion" ? c.subregion === country.subregion : c.continent === country.continent,
    )
    .map((c) => c.id);
  return { kind: "countries", ids };
}

function primaryCapital(country: Country) {
  return country.capitals.find((c) => c.roles.includes("primary")) ?? country.capitals[0];
}

export function buildQuestion(
  ctx: StudyContext,
  cardId: string,
  state: CardState | undefined,
  inputSetting: InputSetting,
  seed: string,
): Question {
  const { entityId, type } = parseCardId(cardId);
  const country = ctx.world.byId.get(entityId);
  const facts = ctx.facts.get(entityId);
  if (!country || !facts) throw new Error(`Unknown country ${entityId}`);
  const rng = createRng(seed);
  const countryType = type as CountryCardType;
  const level = band(state);
  const firstReview = !state || state.reps === 0;
  const loc = ctx.locale;
  const scope = ctx.world.countries;

  const mapLevel =
    inputSetting === "mc" || level === "new"
      ? "subregion"
      : level === "middle"
        ? "continent"
        : "world";
  const textAsChoice =
    inputSetting === "mc" ||
    (inputSetting === "auto" && level === "new") ||
    (inputSetting === "typing" && firstReview);

  const prompt: Prompt =
    countryType === "map_to_name"
      ? { kind: "map", countryId: entityId, view: mapView(country, scope, mapLevel) }
      : countryType === "flag_to_name"
        ? { kind: "flag", countryId: entityId }
        : countryType === "capital_to_country"
          ? { kind: "capital", countryId: entityId, capitalId: primaryCapital(country)?.id ?? "" }
          : { kind: "name", countryId: entityId };

  const countryOptions = (
    count: number,
    dimension: "name" | "flag" | "capital",
    byFlag = false,
  ): string[] =>
    countryDistractors(facts, [...ctx.facts.values()], {
      count,
      rng,
      firstReview,
      byFlag,
      userConfusions: ctx.confusionsFor(entityId),
      curatedConfusions: ctx.curatedFor(entityId, dimension),
    });

  const name = (id: string) => ctx.world.byId.get(id)?.names[loc] ?? id;

  if (countryType === "name_to_map") {
    return {
      cardId,
      entityId,
      type: countryType,
      prompt,
      answer: { kind: "map", view: mapView(country, scope, mapLevel) },
      answerKind: "country",
      correctIds: [entityId],
      mode: "map",
    };
  }

  if (countryType === "name_to_flag") {
    const count = level === "new" ? 3 : 5;
    const ids = shuffle([entityId, ...countryOptions(count, "flag", true)], rng);
    return {
      cardId,
      entityId,
      type: countryType,
      prompt,
      answer: {
        kind: "flags",
        options: ids.map((id) => ({
          id,
          label: name(id),
          flag: ctx.world.byId.get(id)?.iso2 ?? "",
        })),
      },
      answerKind: "country",
      correctIds: [entityId],
      mode: "mc",
    };
  }

  const answerKind = TEXT_ANSWER[countryType] ?? "country";
  const correctIds =
    answerKind === "capital"
      ? country.capitals.map((c) => c.id)
      : answerKind === "currency"
        ? country.currencies.map((c) => c.code)
        : answerKind === "language"
          ? country.officialLanguages.map((l) => l.id)
          : [entityId];

  if (!textAsChoice) {
    return {
      cardId,
      entityId,
      type: countryType,
      prompt,
      answer: { kind: "typed" },
      answerKind,
      correctIds,
      mode: "typed",
    };
  }

  let options: Option[];
  if (answerKind === "country") {
    const dimension =
      countryType === "capital_to_country"
        ? "capital"
        : countryType === "flag_to_name"
          ? "flag"
          : "name";
    options = [entityId, ...countryOptions(3, dimension, dimension === "flag")].map((id) => ({
      id,
      label: name(id),
    }));
  } else if (answerKind === "capital") {
    const correct = primaryCapital(country);
    options = [
      ...(correct ? [{ id: correct.id, label: correct.names[loc] }] : []),
      ...countryOptions(3, "capital").flatMap((id) => {
        const cap = ctx.world.byId.get(id);
        const p = cap ? primaryCapital(cap) : undefined;
        return p ? [{ id: p.id, label: p.names[loc] }] : [];
      }),
    ];
  } else if (answerKind === "currency") {
    const own =
      country.currencies[Math.floor(rng() * country.currencies.length)] ?? country.currencies[0];
    const names = currencyNames(ctx.world);
    options = [
      ...(own ? [{ id: own.code, label: own.names[loc] }] : []),
      ...currencyDistractors(facts, [...ctx.facts.values()], 3, rng).map((code) => ({
        id: code,
        label: names.get(code)?.[loc] ?? code,
      })),
    ];
  } else {
    const own = country.officialLanguages[Math.floor(rng() * country.officialLanguages.length)];
    const names = languageNames(ctx.world);
    options = [
      ...(own ? [{ id: own.id, label: own.names[loc] }] : []),
      ...languageDistractors(facts, [...ctx.facts.values()], 3, rng).map((id) => ({
        id,
        label: names.get(id)?.[loc] ?? id,
      })),
    ];
  }

  return {
    cardId,
    entityId,
    type: countryType,
    prompt,
    answer: { kind: "choice", options: shuffle(options, rng) },
    answerKind,
    correctIds,
    mode: "mc",
  };
}

const currencyCache = new WeakMap<WorldData, Map<string, { en: string; nb: string }>>();
function currencyNames(world: WorldData) {
  let map = currencyCache.get(world);
  if (!map) {
    map = new Map(
      world.countries.flatMap((c) => c.currencies.map((cur) => [cur.code, cur.names] as const)),
    );
    currencyCache.set(world, map);
  }
  return map;
}

const languageCache = new WeakMap<WorldData, Map<string, { en: string; nb: string }>>();
function languageNames(world: WorldData) {
  let map = languageCache.get(world);
  if (!map) {
    map = new Map(
      world.countries.flatMap((c) => c.officialLanguages.map((l) => [l.id, l.names] as const)),
    );
    languageCache.set(world, map);
  }
  return map;
}

export type CheckResult = {
  correct: boolean;
  typo: boolean;
  /** The id the learner chose (entity for choices and map, nearest match for typed), if any. */
  chosenId: string | null;
  /** Correct spelling to show after a typo. */
  matched?: string;
};

/** Checks a chosen option id or clicked country. */
export function checkChoice(question: Question, chosenId: string): CheckResult {
  return { correct: question.correctIds.includes(chosenId), typo: false, chosenId };
}

/** Checks typed text against every accepted answer, in both languages. */
export function checkTyped(question: Question, indexes: Indexes, input: string): CheckResult {
  const index = indexes[question.answerKind];
  let typo: CheckResult | null = null;
  let nearest: string | null = null;
  for (const id of question.correctIds) {
    const result = matchAnswer(input, id, index);
    if (result.kind === "exact")
      return { correct: true, typo: false, chosenId: id, matched: result.matched };
    if (result.kind === "typo")
      typo ??= { correct: true, typo: true, chosenId: id, matched: result.matched };
    if (result.kind === "wrong") nearest ??= result.nearestId;
  }
  return typo ?? { correct: false, typo: false, chosenId: nearest };
}

/** Engine facts for distractors, from the static data. */
export function countryFacts(
  world: WorldData,
  excludeAsDistractor: Record<string, string[]> = {},
): Map<string, CountryFacts> {
  return new Map(
    world.countries.map((c) => [
      c.id,
      {
        id: c.id,
        subregion: c.subregion,
        continent: c.continent,
        flagColors: world.flags[c.id]?.colors.map((x) => x.color) ?? [],
        currencies: c.currencies.map((x) => x.code),
        languages: c.officialLanguages.map((x) => x.id),
        languagesNotDistractors: excludeAsDistractor[c.id] ?? [],
      },
    ]),
  );
}
