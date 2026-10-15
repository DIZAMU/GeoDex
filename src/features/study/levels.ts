/**
 * Levels and XP for the screens (PLAN.md 11.3): the cards in the learner's course, grouped by
 * topic, continent and country, each with its memory level; and XP from events.
 */
import { useMemo } from "react";
import { CONTINENTS, type Continent } from "@/data/types";
import type { WorldData } from "@/data/world";
import { stageOf } from "@/engine/cards";
import type { FocusModule } from "@/engine/focus";
import { groupCardTypes } from "@/engine/groups";
import { type MemoryLevel, memoryLevel } from "@/engine/levels";
import type { CardState } from "@/engine/scheduler";
import {
  CITY_CARD_TYPES,
  COUNTRY_CARD_TYPES,
  type CountryCardType,
  cardId,
  LANDMARK_CARD_TYPES,
  PHYSICAL_CARD_TYPES,
} from "@/engine/types";
import { computeXp, goalToday, type XpLevel, xpLevel } from "@/engine/xp";
import { historyCardTypes, type PlanSettings, scopedCountries, scopedGroup } from "./plan";
import type { Learner } from "./useLearner";

export type CourseCard = {
  cardId: string;
  module: FocusModule;
  continent: Continent | null;
  /** The country the card belongs to, for its country's level. */
  countryId: string | null;
};

const asContinent = (id: string | undefined): Continent | null =>
  (CONTINENTS as readonly string[]).includes(id ?? "") ? (id as Continent) : null;

/** Every card the learner's course holds today: scope, modules and settings applied. */
export function courseCards(
  world: WorldData,
  settings: Pick<PlanSettings, "scope" | "modules" | "currencyAndLanguage">,
): CourseCard[] {
  const countries = scopedCountries(world, settings);
  const inScope = new Map(countries.map((c) => [c.id, c]));
  const on = (m: FocusModule) => settings.modules?.[m] === true;
  const out: CourseCard[] = [];
  for (const c of countries) {
    for (const type of COUNTRY_CARD_TYPES) {
      if (!settings.currencyAndLanguage && stageOf(type as CountryCardType) === 4) continue;
      out.push({
        cardId: cardId(c.id, type),
        module: "countries",
        continent: c.continent,
        countryId: c.id,
      });
    }
  }
  const byCountry = (
    module: FocusModule,
    id: string,
    countryId: string,
    types: readonly string[],
  ) => {
    const country = inScope.get(countryId);
    if (!country) return;
    for (const type of types)
      out.push({ cardId: `${id}:${type}`, module, continent: country.continent, countryId });
  };
  if (on("cities"))
    for (const city of world.cities) byCountry("cities", city.id, city.countryId, CITY_CARD_TYPES);
  if (on("landmarks"))
    for (const l of world.landmarks) byCountry("landmarks", l.id, l.countryId, LANDMARK_CARD_TYPES);
  if (on("groups")) {
    for (const g of world.groups) {
      const scoped = scopedGroup(world, inScope, g.id);
      if (!scoped) continue;
      const continent =
        asContinent(world.subregions.find((s) => s.id === scoped.subregion)?.continent) ?? null;
      for (const type of groupCardTypes(scoped.members.length))
        out.push({ cardId: cardId(g.id, type), module: "groups", continent, countryId: null });
    }
  }
  if (on("physical"))
    for (const f of world.physical)
      for (const type of PHYSICAL_CARD_TYPES)
        out.push({
          cardId: cardId(f.id, type),
          module: "physical",
          continent: asContinent(f.region),
          countryId: null,
        });
  if (on("history"))
    for (const e of world.history)
      for (const type of historyCardTypes(e, (id) => inScope.has(id)))
        out.push({
          cardId: cardId(e.id, type),
          module: "history",
          continent: asContinent(e.region),
          countryId: null,
        });
  return out;
}

export type Levels = {
  overall: MemoryLevel;
  byModule: Map<FocusModule, MemoryLevel>;
  byContinent: Map<Continent, MemoryLevel>;
  country: (id: string) => MemoryLevel;
};

export function computeLevels(
  cards: readonly CourseCard[],
  states: ReadonlyMap<string, CardState>,
): Levels {
  const of = (list: readonly CourseCard[]) => memoryLevel(list.map((c) => states.get(c.cardId)));
  const group = <K>(key: (c: CourseCard) => K | null) => {
    const map = new Map<K, CourseCard[]>();
    for (const c of cards) {
      const k = key(c);
      if (k === null) continue;
      map.set(k, [...(map.get(k) ?? []), c]);
    }
    return new Map([...map].map(([k, list]) => [k, of(list)]));
  };
  const countries = new Map<string, CourseCard[]>();
  for (const c of cards) {
    if (c.countryId) countries.set(c.countryId, [...(countries.get(c.countryId) ?? []), c]);
  }
  return {
    overall: of(cards),
    byModule: group((c) => c.module),
    byContinent: group((c) => c.continent),
    country: (id) => of(countries.get(id) ?? []),
  };
}

export type LearnerLevels = Levels & {
  xp: XpLevel;
  goal: ReturnType<typeof goalToday>;
};

export function learnerLevels(learner: Learner, now: number): LearnerLevels {
  const cards = courseCards(learner.world, learner.settings);
  const options = {
    dayStartHour: learner.settings.dayStartHour,
    dailyGoalMinutes: learner.settings.dailyMinutes,
  };
  return {
    ...computeLevels(cards, learner.states),
    xp: xpLevel(computeXp(learner.events, options).total),
    goal: goalToday(learner.events, now, options),
  };
}

export function useLevels(learner: Learner): LearnerLevels {
  return useMemo(() => learnerLevels(learner, Date.now()), [learner]);
}
