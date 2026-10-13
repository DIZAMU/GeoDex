/**
 * Plans the learning day from settings, card states and events (PLAN.md 6.3).
 * Pure: the Today screen and the session compute the same plan from the same data.
 */

import type { FSRS } from "ts-fsrs";
import type { Country } from "@/data/types";
import type { WorldData } from "@/data/world";
import { type Budget, computeBudget, MAX_DUE_PER_DAY, secondsPerReview } from "@/engine/budget";
import { isIntroduced, stageOf, unlockedNewCards } from "@/engine/cards";
import { confusionScores } from "@/engine/confusions";
import { learningDay } from "@/engine/day";
import { rollingMedian } from "@/engine/grading";
import { type CardState, retrievability } from "@/engine/scheduler";
import { buildQueue, pickNewCards, type QueueItem, subregionOrder } from "@/engine/session";
import {
  type AnswerMode,
  type CardId,
  type CountryCardType,
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
};

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

export function planDay(input: {
  world: WorldData;
  settings: PlanSettings;
  states: ReadonlyMap<CardId, CardState>;
  events: readonly PlanEvent[];
  scheduler: FSRS;
  now: number;
}): DayPlan {
  const { world, settings, states, events, scheduler, now } = input;
  const countries = scopedCountries(world, settings);
  const inScope = new Map(countries.map((c) => [c.id, c]));
  const day = learningDay(now, settings.dayStartHour);

  const due = [...states.values()]
    .filter((s) => s.due < day.end && s.phase !== "new")
    .flatMap((s) => {
      const { entityId, type } = parseCardId(s.cardId);
      const country = inScope.get(entityId);
      // Skip cards of entities out of scope or removed from the data; their events stay.
      if (!country || type === "contrast") return [];
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
  const fresh = pickNewCards(candidates, order, newAllowance);
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
