/**
 * Progress derived from events and card states: streak, achievements and mastery levels.
 * Pure, so a rebuilt card cache gives the same screens (PLAN.md Phase 5 acceptance).
 */
import { useMemo } from "react";
import { type Achievement, computeAchievements, SKILLS, type Skill } from "@/engine/achievements";
import type { CardState } from "@/engine/scheduler";
import { computeStreak, type Streak } from "@/engine/streak";
import { goalDays } from "@/engine/xp";
import { goalOf } from "./levels";
import { scopedCountries } from "./plan";
import type { Learner } from "./useLearner";

export type Level = 0 | 1 | 2 | 3 | 4;

/** 0 unseen, 1 learning, 2 under a week, 3 under three weeks, 4 mastered (21+ days). */
export function cardLevel(state: CardState | undefined): Level {
  if (!state || state.phase === "new") return 0;
  if (state.phase !== "review") return 1;
  if (state.stability < 7) return 2;
  if (state.stability < 21) return 3;
  return 4;
}

/**
 * A country's level for a skill: its weaker card, so both directions must hold before it
 * reads as mastered. A country with any card started is at least "learning", so studying
 * one direction already shows on the map.
 */
export function countryLevel(
  states: ReadonlyMap<string, CardState>,
  id: string,
  skill: Skill,
): Level {
  const levels = SKILLS[skill].map((t) => cardLevel(states.get(`${id}:${t}`)));
  return Math.max(Math.min(...levels), levels.some((l) => l > 0) ? 1 : 0) as Level;
}

export type Progress = {
  streak: Streak;
  achievements: Achievement[];
  levels: (skill: Skill) => Map<string, Level>;
};

export function computeProgress(learner: Learner, now: number): Progress {
  const countries = scopedCountries(learner.world, learner.settings);
  const streak = computeStreak(
    learner.scheduler,
    learner.events,
    now,
    learner.settings.dayStartHour,
    goalDays(learner.events, {
      dayStartHour: learner.settings.dayStartHour,
      goal: goalOf(learner.settings),
    }),
  );
  const achievements = computeAchievements({
    scheduler: learner.scheduler,
    events: learner.events,
    countries,
    streak,
  });
  return {
    streak,
    achievements,
    levels: (skill) =>
      new Map(countries.map((c) => [c.id, countryLevel(learner.states, c.id, skill)])),
  };
}

/** Recomputed when events or settings change; "now" is fixed per render of the screen. */
export function useProgress(learner: Learner): Progress {
  return useMemo(() => computeProgress(learner, Date.now()), [learner]);
}
