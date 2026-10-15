/**
 * XP (PLAN.md 11.3): only goes up, and like everything else is derived from review events,
 * never stored. Memory levels can fall, so XP for memory growth comes from card milestones:
 * the first correct answer after a card held for a week, three weeks and two months.
 */
import { learningDay } from "./day";
import { MASTERED_AFTER_DAYS } from "./estimate";
import { type AnswerMode, DAY_MS, type ReviewEventCore } from "./types";

export const XP_PER_CORRECT: Record<AnswerMode, number> = {
  mc: 10,
  typed: 15,
  map: 15,
  pin: 15,
  placement: 5,
};
/** A run of answers with no gap longer than this is one session. */
export const SESSION_GAP_MS = 15 * 60_000;
/** A session of at least this many answers earns a bonus of XP_PER_SESSION_ANSWER each. */
export const MIN_SESSION_ANSWERS = 5;
export const XP_PER_SESSION_ANSWER = 2;
export const XP_PER_DAY = 10;
export const XP_DAILY_GOAL = 40;
/** Days a card must hold before a correct answer, and the XP that first answer earns. */
export const MILESTONES = [
  { days: 7, xp: 20 },
  { days: 21, xp: 40 },
  { days: MASTERED_AFTER_DAYS, xp: 60 },
] as const;

export type XpEvent = Pick<ReviewEventCore, "cardId" | "reviewedAt" | "mode" | "correct"> & {
  durationMs: number;
};

export type XpBreakdown = {
  answers: number;
  sessions: number;
  days: number;
  goals: number;
  milestones: number;
  total: number;
};

export function computeXp(
  events: readonly XpEvent[],
  options: { dayStartHour: number; dailyGoalMinutes: number },
): XpBreakdown {
  const sorted = [...events].sort(
    (a, b) => a.reviewedAt - b.reviewedAt || a.cardId.localeCompare(b.cardId),
  );
  let answers = 0;
  let sessions = 0;
  let milestones = 0;
  const lastSeen = new Map<string, number>();
  const reached = new Map<string, number>();
  const dayTime = new Map<number, number>();
  let run = 0;
  let previous = Number.NEGATIVE_INFINITY;
  const closeRun = () => {
    if (run >= MIN_SESSION_ANSWERS) sessions += run * XP_PER_SESSION_ANSWER;
    run = 0;
  };

  for (const e of sorted) {
    if (e.correct) answers += XP_PER_CORRECT[e.mode];
    const before = lastSeen.get(e.cardId);
    if (e.correct && before !== undefined) {
      const held = (e.reviewedAt - before) / DAY_MS;
      const done = reached.get(e.cardId) ?? 0;
      let tier = done;
      while (tier < MILESTONES.length && held >= (MILESTONES[tier]?.days ?? Infinity)) {
        milestones += MILESTONES[tier]?.xp ?? 0;
        tier++;
      }
      if (tier > done) reached.set(e.cardId, tier);
    }
    lastSeen.set(e.cardId, e.reviewedAt);
    // Placement is a test, not practice: no session or day credit.
    if (e.mode === "placement") continue;
    if (e.reviewedAt - previous > SESSION_GAP_MS) closeRun();
    run++;
    previous = e.reviewedAt;
    const day = learningDay(e.reviewedAt, options.dayStartHour).start;
    dayTime.set(day, (dayTime.get(day) ?? 0) + Math.max(0, e.durationMs));
  }
  closeRun();

  const goalMs = options.dailyGoalMinutes * 60_000;
  const days = dayTime.size * XP_PER_DAY;
  const goals = [...dayTime.values()].filter((ms) => goalMs > 0 && ms >= goalMs).length;
  const goalXp = goals * XP_DAILY_GOAL;
  return {
    answers,
    sessions,
    days,
    goals: goalXp,
    milestones,
    total: answers + sessions + days + goalXp + milestones,
  };
}

/** Today's study time against the daily goal, for the goal ring. */
export function goalToday(
  events: readonly Pick<XpEvent, "reviewedAt" | "mode" | "durationMs">[],
  now: number,
  options: { dayStartHour: number; dailyGoalMinutes: number },
): { minutes: number; goal: number; done: boolean } {
  const { start, end } = learningDay(now, options.dayStartHour);
  const ms = events
    .filter((e) => e.mode !== "placement" && e.reviewedAt >= start && e.reviewedAt < end)
    .reduce((sum, e) => sum + Math.max(0, e.durationMs), 0);
  const minutes = ms / 60_000;
  return {
    minutes,
    goal: options.dailyGoalMinutes,
    done: options.dailyGoalMinutes > 0 && minutes >= options.dailyGoalMinutes,
  };
}

/** XP needed to reach a level: 0, 100, 300, 600, 1000... */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export const RANKS = [
  "tourist",
  "traveller",
  "explorer",
  "navigator",
  "cartographer",
  "geographer",
  "atlasKeeper",
] as const;
export type Rank = (typeof RANKS)[number];
/** The XP level each rank starts at. */
export const RANK_FROM = [1, 3, 5, 8, 12, 17, 23] as const;

export function rankOf(level: number): Rank {
  let rank: Rank = RANKS[0];
  RANK_FROM.forEach((from, i) => {
    if (level >= from) rank = RANKS[i] ?? rank;
  });
  return rank;
}

export type XpLevel = {
  xp: number;
  level: number;
  rank: Rank;
  /** XP into this level, and the size of this level. */
  into: number;
  span: number;
};

export function xpLevel(xp: number): XpLevel {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  return { xp, level, rank: rankOf(level), into: xp - floor, span: xpForLevel(level + 1) - floor };
}
