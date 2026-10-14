/**
 * Plans the learning day from settings, card states and events (PLAN.md 6.3).
 * Pure: the Today screen and the session compute the same plan from the same data.
 */

import type { FSRS } from "ts-fsrs";
import type { Country } from "@/data/types";
import type { WorldData } from "@/data/world";
import { type Budget, computeBudget, MAX_DUE_PER_DAY, secondsPerReview } from "@/engine/budget";
import { isIntroduced, stageOf, unlockedNewCards } from "@/engine/cards";
import { confusionScores, contrastCardId, contrastCards } from "@/engine/confusions";
import { learningDay } from "@/engine/day";
import { rollingMedian } from "@/engine/grading";
import { groupCardTypes, groupReady } from "@/engine/groups";
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
  parseCardId,
  type ReviewEventCore,
} from "@/engine/types";

export type PlanSettings = {
  homeCountry: string | null;
  dailyMinutes: number;
  newPerDayOverride: number | null;
  dayStartHour: number;
  currencyAndLanguage: boolean;
  scope: { partiallyRecognized: boolean };
  /** Enabled modules and their share of new cards (PLAN.md 6.3). Countries are always on. */
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
        isGroupType(type)
      ) {
        const subregion =
          type === "contrast"
            ? contrastSubregion(entityId)
            : isGroupType(type)
              ? groupSubregion(entityId)
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

  const budget = computeBudget({
    dailyMinutes: settings.dailyMinutes,
    dueToday: due.length,
    secondsPerReview: secondsPerReview(events, now),
    newPerDayOverride: settings.newPerDayOverride,
  });
  const newAllowance = Math.max(0, budget.newToday - startedToday);

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
  // Cities start once their country is introduced, both cards together (PLAN.md 5.3).
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
  const weight = (id: string, fallback: number) => settings.moduleWeights?.[id] ?? fallback;
  const shares = allocateNew(newAllowance, [
    { id: "countries", weight: weight("countries", 3), available: candidates.length },
    { id: "cities", weight: citiesOn ? weight("cities", 1) : 0, available: cityCandidates.length },
    { id: "groups", weight: groupsOn ? weight("groups", 1) : 0, available: groupCandidates.length },
  ]);

  // Contrast cards ahead of new cards (PLAN.md 6.7): pairs the learner keeps confusing, and
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
  ];
  const capped = [...due]
    .sort((a, b) => a.retrievability - b.retrievability)
    .slice(0, MAX_DUE_PER_DAY);
  const queue = buildQueue(capped, fresh);

  const nextSubregion =
    order.find((id) => countries.some((c) => c.subregion === id && !isIntroduced(c.id, states))) ??
    null;

  return { budget, queue, dueCount: capped.length, newCount: fresh.length, nextSubregion, order };
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
