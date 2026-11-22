/**
 * Plans the learning day from settings, card states and events.
 * Pure: the Today screen and the session compute the same plan from the same data.
 */

import type { FSRS } from "ts-fsrs";
import type { Country, HistoricalEntity } from "@/data/types";
import type { WorldData } from "@/data/world";
import {
  type Budget,
  computeBudget,
  DEFAULT_REVIEW_LIMIT,
  MAX_DUE_PER_DAY,
  NEW_CARD_COST_FACTOR,
  secondsPerReview,
} from "@/engine/budget";
import { isIntroduced, stageOf, unlockedNewCards } from "@/engine/cards";
import { confusionScores, contrastCardId, contrastCards } from "@/engine/confusions";
import { learningDay } from "@/engine/day";
import { rollingMedian } from "@/engine/grading";
import { empireReady, groupCardTypes, groupReady } from "@/engine/groups";
import { allocateNew } from "@/engine/modules";
import { type CardState, retrievability } from "@/engine/scheduler";
import { buildQueue, pickNewCards, type QueueItem, subregionOrder } from "@/engine/session";
import {
  type AnswerMode,
  type CardId,
  CITY_CARD_TYPES,
  type CountryCardType,
  cardId,
  GROUP_CARD_TYPES,
  type GroupCardType,
  HISTORY_CARD_TYPES,
  type HistoryCardType,
  LANDMARK_CARD_TYPES,
  type LandmarkCardType,
  PHYSICAL_CARD_TYPES,
  type PhysicalCardType,
  parseCardId,
  type ReviewEventCore,
} from "@/engine/types";

export type PlanSettings = {
  homeCountry: string | null;
  dailyMinutes: number;
  newPerDayOverride: number | null;
  /** Most reviews a day: absent for the default, null for no limit. */
  reviewsPerDay?: number | null;
  dayStartHour: number;
  currencyAndLanguage: boolean;
  scope: { partiallyRecognized: boolean };
  /** Enabled modules and their share of new cards. Countries are always on. */
  modules?: Partial<Record<string, boolean>>;
  moduleWeights?: Partial<Record<string, number>>;
};

/** A city has started once either of its cards has been reviewed. */
export function isCityIntroduced(id: string, states: ReadonlyMap<CardId, unknown>): boolean {
  return CITY_CARD_TYPES.some((type) => states.has(cardId(id, type)));
}

/** A group has started once any of its cards has been reviewed. */
export function isGroupIntroduced(id: string, states: ReadonlyMap<CardId, unknown>): boolean {
  return GROUP_CARD_TYPES.some((type) => states.has(cardId(id, type)));
}

const isGroupType = (type: string): type is GroupCardType =>
  (GROUP_CARD_TYPES as readonly string[]).includes(type);

/** A landmark has started once any of its cards has been reviewed. */
export function isLandmarkIntroduced(id: string, states: ReadonlyMap<CardId, unknown>): boolean {
  return LANDMARK_CARD_TYPES.some((type) => states.has(cardId(id, type)));
}

const isLandmarkType = (type: string): type is LandmarkCardType =>
  (LANDMARK_CARD_TYPES as readonly string[]).includes(type);

/** A physical feature has started once either of its cards has been reviewed. */
export function isFeatureIntroduced(id: string, states: ReadonlyMap<CardId, unknown>): boolean {
  return PHYSICAL_CARD_TYPES.some((type) => states.has(cardId(id, type)));
}

const isPhysicalType = (type: string): type is PhysicalCardType =>
  (PHYSICAL_CARD_TYPES as readonly string[]).includes(type);

/** A history entity has started once any of its cards has been reviewed. */
export function isHistoryIntroduced(id: string, states: ReadonlyMap<CardId, unknown>): boolean {
  return HISTORY_CARD_TYPES.some((type) => states.has(cardId(id, type)));
}

const isHistoryType = (type: string): type is HistoryCardType =>
  (HISTORY_CARD_TYPES as readonly string[]).includes(type);

/**
 * The cards a history entity has: one for a former name, the outline and (with at least two
 * successors in scope) a member card for a dissolved state, the outline and era for an empire.
 */
export function historyCardTypes(
  entity: HistoricalEntity,
  inScope: (id: string) => boolean,
): HistoryCardType[] {
  if (entity.kind === "former_name") return ["former_name_to_country"];
  if (entity.kind === "empire") return ["map_to_empire", "empire_to_era"];
  return entity.successors.filter(inScope).length >= 2
    ? ["map_to_dissolved_state", "dissolved_state_member"]
    : ["map_to_dissolved_state"];
}

/**
 * A group as studied: its members in scope, and the subregion most of them share (first
 * listed wins a tie), which places its cards in the day's region order.
 */
export function scopedGroup(
  world: WorldData,
  inScope: ReadonlyMap<string, Country>,
  id: string,
): { members: string[]; subregion: string } | null {
  const group = world.groupById.get(id);
  const members = (group?.members ?? []).filter((m) => inScope.has(m));
  if (members.length < 2) return null;
  const counts = new Map<string, number>();
  for (const m of members) {
    const sub = inScope.get(m)?.subregion ?? "";
    counts.set(sub, (counts.get(sub) ?? 0) + 1);
  }
  let subregion = "";
  let best = 0;
  for (const [sub, n] of counts) {
    if (n > best) {
      subregion = sub;
      best = n;
    }
  }
  return { members, subregion };
}

export type PlanEvent = ReviewEventCore & { durationMs: number };

export type DayPlan = {
  budget: Budget;
  queue: QueueItem[];
  dueCount: number;
  newCount: number;
  /** Due reviews left out by the daily review limit: what "+10 reviews" can take. */
  reviewsHeldBack: number;
  nextSubregion: string | null;
  order: string[];
};

export function scopedCountries(
  world: WorldData,
  settings: Pick<PlanSettings, "scope">,
): Country[] {
  return world.countries.filter(
    (c) =>
      c.status === "un_member" ||
      c.status === "un_observer" ||
      (settings.scope.partiallyRecognized && c.status === "partially_recognized"),
  );
}

/** New contrast cards a day can add on top of the new-card allowance. */
export const MAX_NEW_CONTRAST_PER_DAY = 3;

export function planDay(input: {
  world: WorldData;
  settings: PlanSettings;
  states: ReadonlyMap<CardId, CardState>;
  events: readonly PlanEvent[];
  scheduler: FSRS;
  now: number;
  /** New cards on top of what is left of today's allowance ("Keep going" on Today). */
  extraNew?: number;
  /** Due reviews past today's review limit ("+10 reviews" on Today). */
  extraReviews?: number;
  /** Written content. Contrast cards exist only for pairs with contrast text. */
  content?: {
    confusion: (a: string, b: string) => unknown;
    confusions?: readonly { a: string; b: string; dimension: string }[];
  } | null;
}): DayPlan {
  const { world, settings, states, events, scheduler, now } = input;
  const hasContrast = (a: string, b: string) => Boolean(input.content?.confusion(a, b));
  const countries = scopedCountries(world, settings);
  const inScope = new Map(countries.map((c) => [c.id, c]));
  const day = learningDay(now, settings.dayStartHour);
  const citiesOn = settings.modules?.cities === true;
  const groupsOn = settings.modules?.groups === true;
  const landmarksOn = settings.modules?.landmarks === true;
  const physicalOn = settings.modules?.physical === true;
  const historyOn = settings.modules?.history === true;
  /** Subregion of a history entity: its first introduced country in scope, else its first. */
  const historySubregion = (id: string): string | undefined => {
    const entity = historyOn ? world.historyById.get(id) : undefined;
    if (!entity) return undefined;
    const near = entity.countries.filter((c) => inScope.has(c));
    const started = near.find((c) => isIntroduced(c, states));
    return inScope.get(started ?? near[0] ?? "")?.subregion;
  };
  /**
   * Subregion of a physical feature: its first country in scope that has been introduced,
   * else its first country in scope. Oceans with no country take the first introduced one.
   */
  const featureSubregion = (id: string): string | undefined => {
    const feature = physicalOn ? world.physicalById.get(id) : undefined;
    if (!feature) return undefined;
    const near = feature.countries.filter((c) => inScope.has(c));
    const started = near.find((c) => isIntroduced(c, states));
    const fallback =
      near[0] ??
      (feature.kind === "ocean"
        ? countries.find((c) => isIntroduced(c.id, states))?.id
        : undefined);
    return inScope.get(started ?? fallback ?? "")?.subregion;
  };
  /** Subregion of a landmark whose country is in scope, when the landmarks module is on. */
  const landmarkSubregion = (id: string) => {
    const landmark = landmarksOn ? world.landmarkById.get(id) : undefined;
    return landmark ? inScope.get(landmark.countryId)?.subregion : undefined;
  };
  const groupSubregion = (id: string) =>
    groupsOn ? scopedGroup(world, inScope, id)?.subregion : undefined;
  /** Subregion of a city whose country is in scope, when the cities module is on. */
  const citySubregion = (id: string) => {
    const city = citiesOn ? world.cityById.get(id) : undefined;
    return city ? inScope.get(city.countryId)?.subregion : undefined;
  };
  /**
   * Subregion of a contrast pair that can be studied: two countries in scope, or a city and
   * the capital it is mistaken for (cities module on). Pairs need contrast text.
   */
  const contrastSubregion = (pair: string): string | undefined => {
    const [a, b] = pair.split("|");
    if (!a || !b || !hasContrast(a, b)) return undefined;
    const first = inScope.get(a);
    if (first && inScope.has(b)) return first.subregion;
    return citySubregion(a) ?? citySubregion(b);
  };

  const due = [...states.values()]
    .filter((s) => s.due < day.end && s.phase !== "new")
    .flatMap((s) => {
      const { entityId, type } = parseCardId(s.cardId);
      if (
        type === "contrast" ||
        type === "city_to_country" ||
        type === "city_to_map" ||
        isGroupType(type) ||
        isLandmarkType(type) ||
        isPhysicalType(type) ||
        isHistoryType(type)
      ) {
        const subregion =
          type === "contrast"
            ? contrastSubregion(entityId)
            : isGroupType(type)
              ? groupSubregion(entityId)
              : isLandmarkType(type)
                ? landmarkSubregion(entityId)
                : isPhysicalType(type)
                  ? featureSubregion(entityId)
                  : isHistoryType(type)
                    ? historySubregion(entityId)
                    : citySubregion(entityId);
        if (!subregion) return [];
        return [
          {
            cardId: s.cardId,
            entityId,
            subregion,
            isNew: false,
            retrievability: retrievability(scheduler, s, now),
          },
        ];
      }
      const country = inScope.get(entityId);
      // Skip cards of entities out of scope or removed from the data; their events stay.
      if (!country) return [];
      if (!settings.currencyAndLanguage && stageOf(type as CountryCardType) === 4) return [];
      return [
        {
          cardId: s.cardId,
          entityId,
          subregion: country.subregion,
          isNew: false,
          retrievability: retrievability(scheduler, s, now),
        },
      ];
    });

  // New cards already started today count against today's allowance.
  const firstReview = new Map<CardId, number>();
  for (const e of events) {
    if (!e.scheduled) continue;
    const seen = firstReview.get(e.cardId);
    if (seen === undefined || e.reviewedAt < seen) firstReview.set(e.cardId, e.reviewedAt);
  }
  const startedToday = [...firstReview.values()].filter(
    (t) => t >= day.start && t < day.end,
  ).length;

  // Cards answered today. Their learning steps always come back, outside the review limit;
  // those started before today are today's reviews so far.
  const touchedToday = new Set<CardId>();
  const reviewedToday = new Set<CardId>();
  for (const e of events) {
    if (!e.scheduled || e.reviewedAt < day.start || e.reviewedAt >= day.end) continue;
    touchedToday.add(e.cardId);
    if ((firstReview.get(e.cardId) ?? e.reviewedAt) < day.start) reviewedToday.add(e.cardId);
  }
  const reviewLimit =
    settings.reviewsPerDay === undefined ? DEFAULT_REVIEW_LIMIT : settings.reviewsPerDay;
  // The day's reviews as they stood when it began, so the new-card room stays put all day.
  const waiting = due.filter((d) => !touchedToday.has(d.cardId));
  const seconds = secondsPerReview(events, now);
  const dayBudget = computeBudget({
    dailyMinutes: settings.dailyMinutes,
    dueToday: waiting.length + reviewedToday.size,
    secondsPerReview: seconds,
    newPerDayOverride: settings.newPerDayOverride,
    reviewLimit,
  });
  const newAllowance = Math.max(0, dayBudget.newToday - startedToday) + (input.extraNew ?? 0);

  const order = subregionOrder(settings.homeCountry ?? "", countries);
  const candidates = countries.flatMap((c) => {
    const introduced = isIntroduced(c.id, states);
    return unlockedNewCards(c.id, states, {
      currencyAndLanguage: settings.currencyAndLanguage,
    }).map((cardId) => ({
      cardId,
      entityId: c.id,
      subregion: c.subregion,
      isNew: true,
      introduced,
      stage: stageOf(parseCardId(cardId).type as CountryCardType),
    }));
  });
  // Cities start once their country is introduced, both cards together.
  const cityCandidates = citiesOn
    ? world.cities.flatMap((city) => {
        const country = inScope.get(city.countryId);
        if (!country || !isIntroduced(country.id, states)) return [];
        const introduced = isCityIntroduced(city.id, states);
        return CITY_CARD_TYPES.map((type) => cardId(city.id, type))
          .filter((id) => !states.has(id))
          .map((id) => ({
            cardId: id,
            entityId: city.id,
            subregion: country.subregion,
            isNew: true,
            introduced,
            stage: 1,
          }));
      })
    : [];
  // Groups start once half their members are introduced, all their cards together.
  const groupCandidates = groupsOn
    ? world.groups.flatMap((group) => {
        const scoped = scopedGroup(world, inScope, group.id);
        if (!scoped) return [];
        const ready = scoped.members.filter((m) => isIntroduced(m, states)).length;
        if (!groupReady(ready, scoped.members.length)) return [];
        const introduced = isGroupIntroduced(group.id, states);
        return groupCardTypes(scoped.members.length)
          .map((type) => cardId(group.id, type))
          .filter((id) => !states.has(id))
          .map((id) => ({
            cardId: id,
            entityId: group.id,
            subregion: scoped.subregion,
            isNew: true,
            introduced,
            stage: 1,
          }));
      })
    : [];
  // Landmarks start once their country is introduced, all three cards together.
  const landmarkCandidates = landmarksOn
    ? world.landmarks.flatMap((landmark) => {
        const country = inScope.get(landmark.countryId);
        if (!country || !isIntroduced(country.id, states)) return [];
        const introduced = isLandmarkIntroduced(landmark.id, states);
        return LANDMARK_CARD_TYPES.map((type) => cardId(landmark.id, type))
          .filter((id) => !states.has(id))
          .map((id) => ({
            cardId: id,
            entityId: landmark.id,
            subregion: country.subregion,
            isNew: true,
            introduced,
            stage: 1,
          }));
      })
    : [];
  // Physical features start once a country they touch is introduced (oceans: any country).
  const anyIntroduced = countries.some((c) => isIntroduced(c.id, states));
  const physicalCandidates = physicalOn
    ? world.physical.flatMap((feature) => {
        const ready =
          feature.kind === "ocean"
            ? anyIntroduced
            : feature.countries.some((c) => inScope.has(c) && isIntroduced(c, states));
        const subregion = ready ? featureSubregion(feature.id) : undefined;
        if (!subregion) return [];
        const introduced = isFeatureIntroduced(feature.id, states);
        return PHYSICAL_CARD_TYPES.map((type) => cardId(feature.id, type))
          .filter((id) => !states.has(id))
          .map((id) => ({
            cardId: id,
            entityId: feature.id,
            subregion,
            isNew: true,
            introduced,
            stage: 1,
          }));
      })
    : [];
  // History: a former name starts with its country, a dissolved state once half its
  // successors are introduced, an empire once a third of the countries it covers are.
  const historyCandidates = historyOn
    ? world.history.flatMap((entity) => {
        const covered = entity.countries.filter((c) => inScope.has(c));
        const ready = covered.filter((c) => isIntroduced(c, states)).length;
        const unlocked =
          entity.kind === "former_name"
            ? ready > 0
            : entity.kind === "dissolved_state"
              ? groupReady(ready, covered.length)
              : empireReady(ready, covered.length);
        const subregion = unlocked ? historySubregion(entity.id) : undefined;
        if (!subregion) return [];
        const introduced = isHistoryIntroduced(entity.id, states);
        return historyCardTypes(entity, (c) => inScope.has(c))
          .map((type) => cardId(entity.id, type))
          .filter((id) => !states.has(id))
          .map((id) => ({
            cardId: id,
            entityId: entity.id,
            subregion,
            isNew: true,
            introduced,
            stage: 1,
          }));
      })
    : [];
  const weight = (id: string, fallback: number) => settings.moduleWeights?.[id] ?? fallback;
  const shares = allocateNew(newAllowance, [
    { id: "countries", weight: weight("countries", 3), available: candidates.length },
    { id: "cities", weight: citiesOn ? weight("cities", 1) : 0, available: cityCandidates.length },
    { id: "groups", weight: groupsOn ? weight("groups", 1) : 0, available: groupCandidates.length },
    {
      id: "landmarks",
      weight: landmarksOn ? weight("landmarks", 1) : 0,
      available: landmarkCandidates.length,
    },
    {
      id: "physical",
      weight: physicalOn ? weight("physical", 1) : 0,
      available: physicalCandidates.length,
    },
    {
      id: "history",
      weight: historyOn ? weight("history", 1) : 0,
      available: historyCandidates.length,
    },
  ]);

  // Contrast cards ahead of new cards: pairs the learner keeps confusing, and
  // each "not the capital" pair once its city has been studied (seeded from confusions.json).
  const earned = contrastCards(confusionScoresFor(world, events, now));
  const seeded = (input.content?.confusions ?? [])
    .filter((c) => c.dimension === "not_capital" && isCityIntroduced(c.a, states))
    .map((c) => contrastCardId(c.a, c.b));
  const contrasts = [...new Set([...earned, ...seeded])]
    .filter((id) => !states.has(id))
    .flatMap((id) => {
      const entityId = parseCardId(id).entityId;
      const subregion = contrastSubregion(entityId);
      return subregion ? [{ cardId: id, entityId, subregion, isNew: true }] : [];
    })
    .slice(0, MAX_NEW_CONTRAST_PER_DAY);
  const fresh = [
    ...contrasts,
    ...pickNewCards(candidates, order, shares.get("countries") ?? 0),
    ...pickNewCards(cityCandidates, order, shares.get("cities") ?? 0),
    ...pickNewCards(groupCandidates, order, shares.get("groups") ?? 0),
    ...pickNewCards(landmarkCandidates, order, shares.get("landmarks") ?? 0),
    ...pickNewCards(physicalCandidates, order, shares.get("physical") ?? 0),
    ...pickNewCards(historyCandidates, order, shares.get("history") ?? 0),
  ];
  // The weakest waiting reviews first, up to what is left of the limit.
  const room = Math.max(0, (reviewLimit ?? MAX_DUE_PER_DAY) - reviewedToday.size);
  const taken = new Set(
    [...waiting]
      .sort((a, b) => a.retrievability - b.retrievability)
      .slice(0, room + (input.extraReviews ?? 0))
      .map((d) => d.cardId),
  );
  const capped = due
    .filter((d) => touchedToday.has(d.cardId) || taken.has(d.cardId))
    .sort((a, b) => a.retrievability - b.retrievability);
  const queue = buildQueue(capped, fresh);
  const budget: Budget = {
    ...dayBudget,
    dueToday: capped.length,
    estimatedMinutes: Math.round(
      (capped.length * seconds + fresh.length * NEW_CARD_COST_FACTOR * seconds) / 60,
    ),
  };

  const nextSubregion =
    order.find((id) => countries.some((c) => c.subregion === id && !isIntroduced(c.id, states))) ??
    null;

  return {
    budget,
    queue,
    dueCount: capped.length,
    newCount: fresh.length,
    reviewsHeldBack: waiting.length - taken.size,
    nextSubregion,
    order,
  };
}

/** Rolling median response time and review count per answer mode, for grading. */
export function modeStats(
  events: readonly PlanEvent[],
): Map<AnswerMode, { median: number | null; count: number }> {
  const byMode = new Map<AnswerMode, number[]>();
  for (const e of [...events].sort((a, b) => a.reviewedAt - b.reviewedAt)) {
    if (!e.scheduled || e.mode === "placement") continue;
    const list = byMode.get(e.mode) ?? [];
    list.push(e.responseMs);
    byMode.set(e.mode, list);
  }
  return new Map(
    [...byMode].map(([mode, list]) => [mode, { median: rollingMedian(list), count: list.length }]),
  );
}

/** Confusion scores, resolving capital answers to their countries. */
export function confusionScoresFor(world: WorldData, events: readonly PlanEvent[], now: number) {
  const capitalToCountry = new Map(
    world.countries.flatMap((c) => c.capitals.map((cap) => [cap.id, c.id] as const)),
  );
  return confusionScores(events, now, (e) => {
    if (!e.chosenAnswer) return null;
    const target = parseCardId(e.cardId).entityId;
    const chosen = world.byId.has(e.chosenAnswer)
      ? e.chosenAnswer
      : capitalToCountry.get(e.chosenAnswer);
    return chosen ? [target, chosen] : null;
  });
}

/** Continent of a subregion, for focusing a session on a continent. */
export function continentLookup(world: WorldData): (subregion: string) => string | undefined {
  const map = new Map(world.subregions.map((s) => [s.id, s.continent as string]));
  return (subregion) => map.get(subregion);
}
