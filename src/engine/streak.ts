/**
 * Streak (PLAN.md 6.10), derived from events. A learning day counts when the learner did at
 * least one scheduled review and either reviewed every card that was due at the start of the
 * day, or did 30+ scheduled reviews because the backlog was larger. Freezes: one per 7
 * counted days in a row, at most 2 held, used automatically on a missed day.
 */
import type { FSRS } from "ts-fsrs";
import { learningDay } from "./day";
import { applyReview, type CardState, compareEvents } from "./scheduler";
import type { ReviewEventCore } from "./types";

export const STREAK_BACKLOG_REVIEWS = 30;
export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;
export const STREAK_MILESTONES = [7, 30, 100, 365] as const;

export type DayRecord = {
  /** Start of the learning day (ms). */
  start: number;
  /** Scheduled reviews done that day (drill and placement excluded). */
  reviews: number;
  /** Cards due at the start of the day. */
  due: number;
  counted: boolean;
  frozen: boolean;
};

export type Streak = {
  current: number;
  longest: number;
  freezes: number;
  days: DayRecord[];
  /** When each milestone was first reached: the end of the day that reached it. */
  milestones: { days: number; at: number }[];
};

function countsForStreak(e: ReviewEventCore): boolean {
  return e.scheduled && e.mode !== "placement";
}

/** Next learning day start after `start`, safe across daylight-saving changes. */
function nextDay(start: number, dayStartHour: number): number {
  return learningDay(start + 36 * 3_600_000, dayStartHour).start;
}

export function computeStreak(
  scheduler: FSRS,
  events: readonly ReviewEventCore[],
  now: number,
  dayStartHour: number,
): Streak {
  const sorted = [...events].sort(compareEvents);
  const first = sorted.find(countsForStreak);
  const empty: Streak = { current: 0, longest: 0, freezes: 0, days: [], milestones: [] };
  if (!first) return empty;

  const states = new Map<string, CardState>();
  const today = learningDay(now, dayStartHour);
  const days: DayRecord[] = [];
  const milestones: Streak["milestones"] = [];
  let index = 0;
  let run = 0;
  let longest = 0;
  let freezes = 0;
  let current = 0;

  for (
    let start = learningDay(first.reviewedAt, dayStartHour).start;
    start <= today.start;
    start = nextDay(start, dayStartHour)
  ) {
    const end = nextDay(start, dayStartHour);
    // Events before this day (placement included) shape what is due today.
    while (index < sorted.length && (sorted[index] as ReviewEventCore).reviewedAt < start) {
      const e = sorted[index] as ReviewEventCore;
      const next = applyReview(scheduler, states.get(e.cardId) ?? null, e);
      if (next) states.set(e.cardId, next);
      index++;
    }
    const dueAtStart = new Set(
      [...states.values()].filter((s) => s.phase !== "new" && s.due < end).map((s) => s.cardId),
    );
    const reviewed = new Set<string>();
    let reviews = 0;
    for (let i = index; i < sorted.length; i++) {
      const e = sorted[i] as ReviewEventCore;
      if (e.reviewedAt >= end) break;
      if (!countsForStreak(e)) continue;
      reviews++;
      reviewed.add(e.cardId);
    }
    const allDueDone = [...dueAtStart].every((id) => reviewed.has(id));
    const counted = reviews > 0 && (allDueDone || reviews >= STREAK_BACKLOG_REVIEWS);
    const isToday = start === today.start;
    let frozen = false;
    if (counted) {
      run++;
      if (run % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
      for (const m of STREAK_MILESTONES) {
        if (run === m && !milestones.some((x) => x.days === m))
          milestones.push({ days: m, at: end });
      }
    } else if (!isToday) {
      if (freezes > 0 && run > 0) {
        freezes--;
        frozen = true;
      } else {
        run = 0;
      }
    }
    longest = Math.max(longest, run);
    // Today in progress never breaks the streak: it only adds once it counts.
    current = run;
    days.push({ start, reviews, due: dueAtStart.size, counted, frozen });
  }
  return { current, longest, freezes, days, milestones };
}
