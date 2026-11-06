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

/** The daily goal (PLAN.md 11.4): minutes of study, or finished sessions. */
export type DailyGoal =
  | { kind: "minutes"; minutes: number }
  | { kind: "sessions"; sessions: number };

export type DayTotal = { ms: number; sessions: number };

type Options = { dayStartHour: number; goal: DailyGoal };

/** Study time and finished sessions per learning day (keyed by its start). Placement is not study. */
export function dayTotals(
  events: readonly Pick<XpEvent, "reviewedAt" | "mode" | "durationMs">[],
  dayStartHour: number,
): Map<number, DayTotal> {
  const sorted = events
    .filter((e) => e.mode !== "placement")
    .sort((a, b) => a.reviewedAt - b.reviewedAt);
  const totals = new Map<number, DayTotal>();
  const day = (at: number) => {
    const key = learningDay(at, dayStartHour).start;
    const total = totals.get(key) ?? { ms: 0, sessions: 0 };
    totals.set(key, total);
    return total;
  };
  let run = 0;
  let runStart = 0;
  let previous = Number.NEGATIVE_INFINITY;
  const closeRun = () => {
    // A session belongs to the day it started on.
    if (run >= MIN_SESSION_ANSWERS) day(runStart).sessions++;
    run = 0;
  };
  for (const e of sorted) {
    if (e.reviewedAt - previous > SESSION_GAP_MS) {
      closeRun();
      runStart = e.reviewedAt;
    }
    run++;
    previous = e.reviewedAt;
    day(e.reviewedAt).ms += Math.max(0, e.durationMs);
  }
  closeRun();
  return totals;
}

export function goalMet(total: DayTotal | undefined, goal: DailyGoal): boolean {
  if (!total) return false;
  return goal.kind === "minutes"
    ? goal.minutes > 0 && total.ms >= goal.minutes * 60_000
    : goal.sessions > 0 && total.sessions >= goal.sessions;
}

/** Learning days (by start) on which the daily goal was met, for XP and the streak. */
export function goalDays(
  events: readonly Pick<XpEvent, "reviewedAt" | "mode" | "durationMs">[],
  options: Options,
): Set<number> {
  return new Set(
    [...dayTotals(events, options.dayStartHour)]
      .filter(([, total]) => goalMet(total, options.goal))
      .map(([start]) => start),
  );
}

export function computeXp(events: readonly XpEvent[], options: Options): XpBreakdown {
  const sorted = [...events].sort(
    (a, b) => a.reviewedAt - b.reviewedAt || a.cardId.localeCompare(b.cardId),
  );
  let answers = 0;
  let sessions = 0;
  let milestones = 0;
  const lastSeen = new Map<string, number>();
  const reached = new Map<string, number>();
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
  }
  closeRun();

  const totals = dayTotals(events, options.dayStartHour);
  const days = totals.size * XP_PER_DAY;
  const goals = [...totals.values()].filter((t) => goalMet(t, options.goal)).length * XP_DAILY_GOAL;
  return {
    answers,
    sessions,
    days,
    goals,
    milestones,
    total: answers + sessions + days + goals + milestones,
  };
}

/** Today against the daily goal, for the goal ring: minutes or sessions done of the target. */
export function goalToday(
  events: readonly Pick<XpEvent, "reviewedAt" | "mode" | "durationMs">[],
  now: number,
  options: Options,
): { kind: DailyGoal["kind"]; done: number; target: number; met: boolean } {
  const total = dayTotals(events, options.dayStartHour).get(
    learningDay(now, options.dayStartHour).start,
  );
  const { goal } = options;
  return {
    kind: goal.kind,
    done: goal.kind === "minutes" ? (total?.ms ?? 0) / 60_000 : (total?.sessions ?? 0),
    target: goal.kind === "minutes" ? goal.minutes : goal.sessions,
    met: goalMet(total, goal),
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
  /** The XP level behind the rank. Internal: the app shows the rank, not this number. */
  level: number;
  rank: Rank;
  /** XP into this level, and the size of this level. */
  into: number;
  span: number;
  /** The rank after this one and the XP to reach it; null at the top rank. */
  nextRank: Rank | null;
  toNextRank: number | null;
  /** How far from this rank's start to the next, 0 to 1 (1 at the top rank). */
  rankShare: number;
};

export function xpLevel(xp: number): XpLevel {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  const rank = rankOf(level);
  const index = RANKS.indexOf(rank);
  const nextFrom = RANK_FROM[index + 1];
  const nextRank = RANKS[index + 1] ?? null;
  const rankStart = xpForLevel(RANK_FROM[index] ?? 1);
  const rankEnd = nextFrom === undefined ? null : xpForLevel(nextFrom);
  return {
    xp,
    level,
    rank,
    into: xp - floor,
    span: xpForLevel(level + 1) - floor,
    nextRank: rankEnd === null ? null : nextRank,
    toNextRank: rankEnd === null ? null : rankEnd - xp,
    rankShare: rankEnd === null ? 1 : (xp - rankStart) / (rankEnd - rankStart),
  };
}
