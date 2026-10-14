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
import { haversineKm } from "@/engine/geo";
import { CITY_PIN, gradePin, LANDMARK_PIN } from "@/engine/grading";
import { gradeTaps, groupNameDistractors, pickFromPools, pickMember } from "@/engine/groups";
import { type Answerable, buildIndex, matchAnswer } from "@/engine/matching";
import { createRng, shuffle } from "@/engine/random";
import type { CardState } from "@/engine/scheduler";
import {
  type AnswerMode,
  type CardType,
  type CountryCardType,
  type GroupCardType,
  type InputSetting,
  type LandmarkCardType,
  parseCardId,
  type Rating,
} from "@/engine/types";
import type { Locale } from "@/i18n/locales";

export type MapView = { kind: "world" } | { kind: "countries"; ids: string[] };

export type Prompt =
  | { kind: "map"; countryId: string; view: MapView }
  | { kind: "name"; countryId: string }
  | { kind: "flag"; countryId: string }
  | { kind: "capital"; countryId: string; capitalId: string }
  /** A city by name: "Which country is Sydney in?" or "Where is Sydney?". */
  | { kind: "city"; countryId: string; cityId: string; place: boolean }
  /** "Which is the capital of Australia?" for a city mistaken for the capital. */
  | { kind: "capitalOf"; countryId: string }
  /** A group by name: "Which of these is in the Balkans?", "Tap every country in it". */
  | { kind: "group"; groupId: string }
  /** A landmark's photo: "What is this?". */
  | { kind: "photo"; landmarkId: string; countryId: string }
  /** A landmark by name: "Which country is it in?" or "Where is it?". */
  | { kind: "landmark"; landmarkId: string; countryId: string; place: boolean }
  /** A group shown on the map: its members highlighted inside `view`. */
  | { kind: "groupMap"; groupId: string; ids: string[]; view: MapView };

export type Option = { id: string; label: string; flag?: string };

export type AnswerFormat =
  | { kind: "choice"; options: Option[] }
  | { kind: "flags"; options: Option[] }
  | { kind: "typed" }
  | { kind: "map"; view: MapView; selectable?: string[] }
  /** Tap the spot on the map; graded by distance to `target` [lon, lat]. */
  | { kind: "pin"; view: MapView; target: [number, number] }
  /** Tap every member, then check. `sometimes` taps are neither right nor wrong. */
  | { kind: "taps"; view: MapView; members: string[]; sometimes: string[] };

export type AnswerKind = "country" | "capital" | "currency" | "language" | "group" | "landmark";

export type Question = {
  cardId: string;
  /** The entity asked about. For a contrast card, the one of the pair this review asks for. */
  entityId: string;
  /** The country the card is about: the entity itself, the country of a city, or a group's first member. */
  countryId: string;
  /** Group cards: the group asked about. */
  groupId?: string;
  type: CardType;
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
  /** How a contrast pair is told apart, when contrast text exists for it. */
  contrastKind: (a: string, b: string) => "flag" | "place" | null;
  indexes: Indexes;
  /** Countries in the learner's scope, for group members. Absent means every country. */
  scope?: ReadonlySet<string>;
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
  const groups: Answerable[] = world.groups.map((g) => ({
    id: g.id,
    names: [g.names.en, g.names.nb, ...g.aliases.en, ...g.aliases.nb],
  }));
  const landmarks: Answerable[] = world.landmarks.map((l) => ({
    id: l.id,
    names: [l.names.en, l.names.nb, ...l.aliases.en, ...l.aliases.nb],
  }));
  return {
    country: buildIndex(countries),
    capital: buildIndex(capitals),
    currency: buildIndex(currencies),
    language: buildIndex(languages),
    group: buildIndex(groups),
    landmark: buildIndex(landmarks),
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
  if (type === "contrast") return contrastQuestion(ctx, cardId, entityId, seed);
  if (type === "city_to_country" || type === "city_to_map") {
    return cityQuestion(ctx, cardId, entityId, type, state, inputSetting, seed);
  }
  if (type === "photo_to_name" || type === "landmark_to_country" || type === "landmark_to_map") {
    return landmarkQuestion(ctx, cardId, entityId, type, state, inputSetting, seed);
  }
  if (type === "group_to_map" || type === "map_to_group" || type === "group_member") {
    return groupQuestion(ctx, cardId, entityId, type, state, inputSetting, seed);
  }
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
      countryId: entityId,
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
      countryId: entityId,
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
      countryId: entityId,
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
    countryId: entityId,
    type: countryType,
    prompt,
    answer: { kind: "choice", options: shuffle(options, rng) },
    answerKind,
    correctIds,
    mode: "mc",
  };
}

/**
 * A contrast card ("Which of these is X?"): the two look-alikes side by side, as flags for a
 * flag pair, otherwise as the two shapes on the map. The seed picks which one is asked.
 */
function contrastQuestion(ctx: StudyContext, cardId: string, pair: string, seed: string): Question {
  const [a, b] = pair.split("|");
  const city = ctx.world.cityById.get(a ?? "") ?? ctx.world.cityById.get(b ?? "");
  if (city)
    return notCapitalQuestion(ctx, cardId, city.id, city.id === a ? (b ?? "") : (a ?? ""), seed);
  const first = a ? ctx.world.byId.get(a) : undefined;
  const second = b ? ctx.world.byId.get(b) : undefined;
  if (!first || !second) throw new Error(`Unknown contrast pair ${pair}`);
  const rng = createRng(seed);
  const target = rng() < 0.5 ? first : second;
  const ids = shuffle([first.id, second.id], rng);
  const base = {
    cardId,
    entityId: target.id,
    countryId: target.id,
    type: "contrast" as const,
    prompt: { kind: "name" as const, countryId: target.id },
    answerKind: "country" as const,
    correctIds: [target.id],
  };
  if (ctx.contrastKind(first.id, second.id) === "flag") {
    return {
      ...base,
      answer: {
        kind: "flags",
        options: ids.map((id) => ({
          id,
          label: ctx.world.byId.get(id)?.names[ctx.locale] ?? id,
          flag: ctx.world.byId.get(id)?.iso2 ?? "",
        })),
      },
      mode: "mc",
    };
  }
  return {
    ...base,
    answer: { kind: "map", view: { kind: "countries", ids }, selectable: ids },
    mode: "map",
  };
}

/**
 * "Which is the capital of Australia?": the capital and the city mistaken for it, side by
 * side (PLAN.md 5.2, not_capital confusions).
 */
function notCapitalQuestion(
  ctx: StudyContext,
  cardId: string,
  cityId: string,
  capitalId: string,
  seed: string,
): Question {
  const city = ctx.world.cityById.get(cityId);
  const country = city ? ctx.world.byId.get(city.countryId) : undefined;
  const capital = country?.capitals.find((c) => c.id === capitalId);
  if (!city || !country || !capital) throw new Error(`Unknown not-the-capital pair ${cardId}`);
  const rng = createRng(seed);
  return {
    cardId,
    entityId: cityId,
    countryId: country.id,
    type: "contrast",
    prompt: { kind: "capitalOf", countryId: country.id },
    answer: {
      kind: "choice",
      options: shuffle(
        [
          { id: capital.id, label: capital.names[ctx.locale] },
          { id: city.id, label: city.names[ctx.locale] },
        ],
        rng,
      ),
    },
    answerKind: "capital",
    correctIds: [capital.id],
    mode: "mc",
  };
}

/** City cards: which country a city is in, and where it is on the map (a pin). */
function cityQuestion(
  ctx: StudyContext,
  cardId: string,
  cityId: string,
  type: "city_to_country" | "city_to_map",
  state: CardState | undefined,
  inputSetting: InputSetting,
  seed: string,
): Question {
  const city = ctx.world.cityById.get(cityId);
  const country = city ? ctx.world.byId.get(city.countryId) : undefined;
  const facts = country ? ctx.facts.get(country.id) : undefined;
  if (!city || !country || !facts) throw new Error(`Unknown city ${cityId}`);
  const rng = createRng(seed);
  const level = band(state);
  const firstReview = !state || state.reps === 0;
  const base = { cardId, entityId: city.id, countryId: country.id, type };
  if (type === "city_to_map") {
    // New: the country's region; then its continent; then the whole world.
    const mapLevel =
      inputSetting === "mc" || level === "new"
        ? "subregion"
        : level === "middle"
          ? "continent"
          : "world";
    return {
      ...base,
      prompt: { kind: "city", countryId: country.id, cityId: city.id, place: true },
      answer: {
        kind: "pin",
        view: mapView(country, ctx.world.countries, mapLevel),
        target: [city.lon, city.lat],
      },
      answerKind: "country",
      correctIds: [city.id],
      mode: "pin",
    };
  }
  const prompt: Prompt = { kind: "city", countryId: country.id, cityId: city.id, place: false };
  const textAsChoice =
    inputSetting === "mc" ||
    (inputSetting === "auto" && level === "new") ||
    (inputSetting === "typing" && firstReview);
  if (!textAsChoice) {
    return {
      ...base,
      prompt,
      answer: { kind: "typed" },
      answerKind: "country",
      correctIds: [country.id],
      mode: "typed",
    };
  }
  const others = countryDistractors(facts, [...ctx.facts.values()], {
    count: 3,
    rng,
    firstReview,
    byFlag: false,
    userConfusions: ctx.confusionsFor(country.id),
    curatedConfusions: ctx.curatedFor(country.id, "name"),
  });
  return {
    ...base,
    prompt,
    answer: {
      kind: "choice",
      options: shuffle(
        [country.id, ...others].map((id) => ({
          id,
          label: ctx.world.byId.get(id)?.names[ctx.locale] ?? id,
        })),
        rng,
      ),
    },
    answerKind: "country",
    correctIds: [country.id],
    mode: "mc",
  };
}

/**
 * Landmark cards (PLAN.md 5.3): name it from its photo, say which country it is in, or pin
 * it on the map (graded 150/500 km).
 */
function landmarkQuestion(
  ctx: StudyContext,
  cardId: string,
  landmarkId: string,
  type: LandmarkCardType,
  state: CardState | undefined,
  inputSetting: InputSetting,
  seed: string,
): Question {
  const landmark = ctx.world.landmarkById.get(landmarkId);
  const country = landmark ? ctx.world.byId.get(landmark.countryId) : undefined;
  const facts = country ? ctx.facts.get(country.id) : undefined;
  if (!landmark || !country || !facts) throw new Error(`Unknown landmark ${landmarkId}`);
  const rng = createRng(seed);
  const level = band(state);
  const firstReview = !state || state.reps === 0;
  const textAsChoice =
    inputSetting === "mc" ||
    (inputSetting === "auto" && level === "new") ||
    (inputSetting === "typing" && firstReview);
  const base = { cardId, entityId: landmark.id, countryId: country.id, type };
  const loc = ctx.locale;

  if (type === "landmark_to_map") {
    const mapLevel =
      inputSetting === "mc" || level === "new"
        ? "subregion"
        : level === "middle"
          ? "continent"
          : "world";
    return {
      ...base,
      prompt: { kind: "landmark", landmarkId, countryId: country.id, place: true },
      answer: {
        kind: "pin",
        view: mapView(country, ctx.world.countries, mapLevel),
        target: [landmark.lon, landmark.lat],
      },
      answerKind: "landmark",
      correctIds: [landmark.id],
      mode: "pin",
    };
  }

  if (type === "photo_to_name") {
    const prompt: Prompt = { kind: "photo", landmarkId, countryId: country.id };
    if (!textAsChoice) {
      return {
        ...base,
        prompt,
        answer: { kind: "typed" },
        answerKind: "landmark",
        correctIds: [landmark.id],
        mode: "typed",
      };
    }
    // Wrong names from the same region first, so the photo has to be read, not the continent.
    const near = (pred: (c: { subregion: string; continent: string }) => boolean) =>
      ctx.world.landmarks
        .filter((l) => {
          const c = ctx.world.byId.get(l.countryId);
          return c ? pred(c) : false;
        })
        .map((l) => l.id);
    const others = pickFromPools(
      [
        near((c) => c.subregion === country.subregion),
        near((c) => c.continent === country.continent),
        ctx.world.landmarks.map((l) => l.id),
      ],
      new Set([landmark.id]),
      3,
      rng,
    );
    return {
      ...base,
      prompt,
      answer: {
        kind: "choice",
        options: shuffle(
          [landmark.id, ...others].map((id) => ({
            id,
            label: ctx.world.landmarkById.get(id)?.names[loc] ?? id,
          })),
          rng,
        ),
      },
      answerKind: "landmark",
      correctIds: [landmark.id],
      mode: "mc",
    };
  }

  const prompt: Prompt = { kind: "landmark", landmarkId, countryId: country.id, place: false };
  if (!textAsChoice) {
    return {
      ...base,
      prompt,
      answer: { kind: "typed" },
      answerKind: "country",
      correctIds: [country.id],
      mode: "typed",
    };
  }
  const others = countryDistractors(facts, [...ctx.facts.values()], {
    count: 3,
    rng,
    firstReview,
    byFlag: false,
    userConfusions: ctx.confusionsFor(country.id),
    curatedConfusions: ctx.curatedFor(country.id, "name"),
  });
  return {
    ...base,
    prompt,
    answer: {
      kind: "choice",
      options: shuffle(
        [country.id, ...others].map((id) => ({
          id,
          label: ctx.world.byId.get(id)?.names[loc] ?? id,
        })),
        rng,
      ),
    },
    answerKind: "country",
    correctIds: [country.id],
    mode: "mc",
  };
}

/** A group's members and "sometimes" members, limited to the learner's scope. */
export function scopedMembers(
  ctx: Pick<StudyContext, "world" | "scope">,
  groupId: string,
): { members: string[]; sometimes: string[] } {
  const group = ctx.world.groupById.get(groupId);
  const keep = (id: string) => ctx.world.byId.has(id) && (!ctx.scope || ctx.scope.has(id));
  return {
    members: (group?.members ?? []).filter(keep),
    sometimes: (group?.sometimes ?? []).filter(keep),
  };
}

/**
 * The map area for a group: every country in its members' subregions and their neighbors,
 * so the members are never the only shapes on screen.
 */
export function groupArea(ctx: Pick<StudyContext, "world" | "scope">, members: string[]): MapView {
  const countries = ctx.world.countries.filter((c) => !ctx.scope || ctx.scope.has(c.id));
  const subregions = new Set(members.map((id) => ctx.world.byId.get(id)?.subregion));
  const near = new Set(members.flatMap((id) => ctx.world.byId.get(id)?.neighbors ?? []));
  const ids = countries
    .filter((c) => subregions.has(c.subregion) || near.has(c.id) || members.includes(c.id))
    .map((c) => c.id);
  return { kind: "countries", ids };
}

/**
 * Group cards (DECISIONS.md 034): tap every member, name the highlighted group, or pick the
 * member among countries outside it.
 */
function groupQuestion(
  ctx: StudyContext,
  cardId: string,
  groupId: string,
  type: GroupCardType,
  state: CardState | undefined,
  inputSetting: InputSetting,
  seed: string,
): Question {
  const group = ctx.world.groupById.get(groupId);
  const { members, sometimes } = scopedMembers(ctx, groupId);
  if (!group || members.length === 0) throw new Error(`Unknown group ${groupId}`);
  const rng = createRng(seed);
  const level = band(state);
  const firstReview = !state || state.reps === 0;
  const textAsChoice =
    inputSetting === "mc" ||
    (inputSetting === "auto" && level === "new") ||
    (inputSetting === "typing" && firstReview);
  const area = groupArea(ctx, members);
  const base = { cardId, entityId: groupId, countryId: members[0] ?? "", groupId, type };
  const loc = ctx.locale;

  if (type === "group_to_map") {
    return {
      ...base,
      prompt: { kind: "group", groupId },
      answer: { kind: "taps", view: area, members, sometimes },
      answerKind: "country",
      correctIds: members,
      mode: "map",
    };
  }

  if (type === "map_to_group") {
    const prompt: Prompt = { kind: "groupMap", groupId, ids: members, view: area };
    if (!textAsChoice) {
      return {
        ...base,
        prompt,
        answer: { kind: "typed" },
        answerKind: "group",
        correctIds: [groupId],
        mode: "typed",
      };
    }
    const studied = ctx.world.groups
      .map((g) => ({ id: g.id, members: scopedMembers(ctx, g.id).members }))
      .filter((g) => g.members.length >= 2);
    const others = groupNameDistractors(
      { id: groupId, members },
      studied,
      (id) => ctx.world.byId.get(id)?.continent,
      3,
      rng,
    );
    return {
      ...base,
      prompt,
      answer: {
        kind: "choice",
        options: shuffle(
          [groupId, ...others].map((id) => ({
            id,
            label: ctx.world.groupById.get(id)?.names[loc] ?? id,
          })),
          rng,
        ),
      },
      answerKind: "group",
      correctIds: [groupId],
      mode: "mc",
    };
  }

  const prompt: Prompt = { kind: "group", groupId };
  if (!textAsChoice) {
    return {
      ...base,
      prompt,
      answer: { kind: "typed" },
      answerKind: "country",
      correctIds: members,
      mode: "typed",
    };
  }
  const member = pickMember(members, seed);
  const countries = ctx.world.countries.filter((c) => !ctx.scope || ctx.scope.has(c.id));
  const subregions = new Set(members.map((id) => ctx.world.byId.get(id)?.subregion));
  const continents = new Set(members.map((id) => ctx.world.byId.get(id)?.continent));
  const wrong = pickFromPools(
    [
      members.flatMap((id) => ctx.world.byId.get(id)?.neighbors ?? []),
      countries.filter((c) => subregions.has(c.subregion)).map((c) => c.id),
      countries.filter((c) => continents.has(c.continent)).map((c) => c.id),
      countries.map((c) => c.id),
    ].map((pool) => pool.filter((id) => !ctx.scope || ctx.scope.has(id))),
    new Set([...members, ...sometimes]),
    3,
    rng,
  );
  return {
    ...base,
    countryId: member,
    prompt,
    answer: {
      kind: "choice",
      options: shuffle(
        [member, ...wrong].map((id) => ({
          id,
          label: ctx.world.byId.get(id)?.names[loc] ?? id,
        })),
        rng,
      ),
    },
    answerKind: "country",
    correctIds: members,
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
  /** Pin answers: how far the pin landed from the target, and the rating that earns. */
  distanceKm?: number;
  rating?: Rating;
  /** Pin answers: where the learner tapped, [lon, lat]. */
  pinned?: [number, number];
  /** Tap answers: every country tapped, the members missed and the wrong taps. */
  taps?: { tapped: string[]; missed: string[]; wrong: string[] };
};

/** Checks a chosen option id or clicked country. */
export function checkChoice(question: Question, chosenId: string): CheckResult {
  return { correct: question.correctIds.includes(chosenId), typo: false, chosenId };
}

/** Checks a pin against the target: graded by distance (PLAN.md 5.3). */
export function checkPin(question: Question, at: [number, number]): CheckResult {
  if (question.answer.kind !== "pin") throw new Error("Not a pin question");
  const [lon, lat] = question.answer.target;
  const distanceKm = Math.round(haversineKm(at[0], at[1], lon, lat));
  const limits = question.type === "landmark_to_map" ? LANDMARK_PIN : CITY_PIN;
  const { rating, correct } = gradePin(distanceKm, limits);
  return { correct, typo: false, chosenId: null, distanceKm, rating, pinned: at };
}

/** Checks the countries tapped for a group: graded by misses and wrong taps. */
export function checkTaps(question: Question, tapped: Iterable<string>): CheckResult {
  if (question.answer.kind !== "taps") throw new Error("Not a tap question");
  const list = [...new Set(tapped)].sort();
  const { members, sometimes } = question.answer;
  const { missed, wrong, rating, correct } = gradeTaps(members, sometimes, list);
  return {
    correct,
    typo: false,
    chosenId: wrong[0] ?? null,
    rating,
    taps: { tapped: list, missed, wrong },
  };
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
