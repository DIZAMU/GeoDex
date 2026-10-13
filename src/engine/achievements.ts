/**
 * Achievements (PLAN.md 6.11), derived by replaying events in order: `earnedAt` is the
 * moment the condition first held. Never revoked, even if cards later lapse.
 */
import type { FSRS } from "ts-fsrs";
import { applyReview, type CardState, compareEvents } from "./scheduler";
import type { Streak } from "./streak";
import { type CountryCardType, parseCardId, type ReviewEventCore } from "./types";

export const MASTERED_DAYS = 21;

export const SKILLS = {
  location: ["map_to_name", "name_to_map"],
  capitals: ["country_to_capital", "capital_to_country"],
  flags: ["flag_to_name", "name_to_flag"],
  currency_language: ["country_to_currency", "country_to_language"],
} as const satisfies Record<string, readonly CountryCardType[]>;
export type Skill = keyof typeof SKILLS;
export const SKILL_IDS = Object.keys(SKILLS) as Skill[];

export function skillOf(type: string): Skill | null {
  for (const skill of SKILL_IDS) {
    if ((SKILLS[skill] as readonly string[]).includes(type)) return skill;
  }
  return null;
}

export type Achievement =
  | { id: string; kind: "region"; skill: Skill; subregion: string; earnedAt: number }
  | { id: string; kind: "continent"; skill: Skill; continent: string; earnedAt: number }
  | { id: string; kind: "world"; skill: Skill; earnedAt: number }
  | { id: string; kind: "untangled"; pair: string; earnedAt: number }
  | { id: string; kind: "streak"; days: number; earnedAt: number };

export function isMastered(state: CardState | undefined): boolean {
  return state?.phase === "review" && state.stability >= MASTERED_DAYS;
}

type Place = { id: string; subregion: string; continent: string };

export function computeAchievements(input: {
  scheduler: FSRS;
  events: readonly ReviewEventCore[];
  countries: readonly Place[];
  streak?: Pick<Streak, "milestones">;
}): Achievement[] {
  const { countries } = input;
  const place = new Map(countries.map((c) => [c.id, c]));
  const subregionSize = new Map<string, number>();
  const continentSubregions = new Map<string, Set<string>>();
  for (const c of countries) {
    subregionSize.set(c.subregion, (subregionSize.get(c.subregion) ?? 0) + 1);
    const set = continentSubregions.get(c.continent) ?? new Set<string>();
    set.add(c.subregion);
    continentSubregions.set(c.continent, set);
  }

  const states = new Map<string, CardState>();
  // Mastered card count per skill and subregion; a region needs 2 cards per country.
  const mastered = new Map<string, number>();
  const earned = new Map<string, Achievement>();
  const regionDone = new Map<Skill, Set<string>>();
  const continentDone = new Map<Skill, Set<string>>();
  const earn = (a: Achievement) => {
    if (!earned.has(a.id)) earned.set(a.id, a);
  };

  for (const e of [...input.events].sort(compareEvents)) {
    const before = states.get(e.cardId);
    const after = applyReview(input.scheduler, before ?? null, e);
    if (!after) continue;
    states.set(e.cardId, after);
    const was = isMastered(before);
    const now = isMastered(after);
    const { entityId, type } = parseCardId(e.cardId);

    if (type === "contrast") {
      if (now)
        earn({
          id: `untangled:${entityId}`,
          kind: "untangled",
          pair: entityId,
          earnedAt: e.reviewedAt,
        });
      continue;
    }
    const skill = skillOf(type);
    const country = place.get(entityId);
    if (!skill || !country || was === now) continue;
    const key = `${skill}:${country.subregion}`;
    const count = (mastered.get(key) ?? 0) + (now ? 1 : -1);
    mastered.set(key, count);
    if (!now || count < (subregionSize.get(country.subregion) ?? 0) * 2) continue;

    earn({
      id: `region:${key}`,
      kind: "region",
      skill,
      subregion: country.subregion,
      earnedAt: e.reviewedAt,
    });
    const regions = regionDone.get(skill) ?? new Set<string>();
    regions.add(country.subregion);
    regionDone.set(skill, regions);
    const needed = continentSubregions.get(country.continent) ?? new Set<string>();
    if ([...needed].every((s) => regions.has(s))) {
      earn({
        id: `continent:${skill}:${country.continent}`,
        kind: "continent",
        skill,
        continent: country.continent,
        earnedAt: e.reviewedAt,
      });
      const continents = continentDone.get(skill) ?? new Set<string>();
      continents.add(country.continent);
      continentDone.set(skill, continents);
      if (continents.size === continentSubregions.size) {
        earn({ id: `world:${skill}`, kind: "world", skill, earnedAt: e.reviewedAt });
      }
    }
  }
  for (const m of input.streak?.milestones ?? []) {
    earn({ id: `streak:${m.days}`, kind: "streak", days: m.days, earnedAt: m.at });
  }
  // Stable sort: achievements earned at the same moment keep the order they were earned in.
  return [...earned.values()].sort((a, b) => a.earnedAt - b.earnedAt);
}
