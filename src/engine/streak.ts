/**
 * Streak, derived from events. A learning day counts when the learner did at least one
 * scheduled review and either reviewed every card that was due at the start of the day, or
 * did 30+ scheduled reviews because the backlog was larger, or met the daily goal. Freezes:
 * one per 7 counted days in a row, at most 2 held, used automatically on a missed day.
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
  /** Each freeze earned and used, by the start of its learning day, oldest first. */
  freezeEvents: FreezeEvent[];
  /** Counted days until the next freeze, today included if it has not counted yet; null at the cap. */
  nextFreezeIn: number | null;
};

export type FreezeEvent = { kind: "earned" | "used"; day: number };

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
  /** Learning days (by start) on which the daily goal was met. */
  goalMetDays: ReadonlySet<number> = new Set(),
): Streak {
  const sorted = [...events].sort(compareEvents);
  const first = sorted.find(countsForStreak);
  const empty: Streak = {
    current: 0,
    longest: 0,
    freezes: 0,
    days: [],
    milestones: [],
    freezeEvents: [],
    nextFreezeIn: FREEZE_EVERY,
  };
  if (!first) return empty;

  const states = new Map<string, CardState>();
  const today = learningDay(now, dayStartHour);
  const days: DayRecord[] = [];
  const milestones: Streak["milestones"] = [];
  const freezeEvents: FreezeEvent[] = [];
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
    const counted =
      reviews > 0 && (allDueDone || reviews >= STREAK_BACKLOG_REVIEWS || goalMetDays.has(start));
    const isToday = start === today.start;
    let frozen = false;
    if (counted) {
      run++;
      if (run % FREEZE_EVERY === 0 && freezes < MAX_FREEZES) {
        freezes++;
        freezeEvents.push({ kind: "earned", day: start });
      }
      for (const m of STREAK_MILESTONES) {
        if (run === m && !milestones.some((x) => x.days === m))
          milestones.push({ days: m, at: end });
      }
    } else if (!isToday) {
      if (freezes > 0 && run > 0) {
        freezes--;
        frozen = true;
        freezeEvents.push({ kind: "used", day: start });
      } else {
        run = 0;
      }
    }
    longest = Math.max(longest, run);
    // Today in progress never breaks the streak: it only adds once it counts.
    current = run;
    days.push({ start, reviews, due: dueAtStart.size, counted, frozen });
  }
  const nextFreezeIn = freezes >= MAX_FREEZES ? null : FREEZE_EVERY - (run % FREEZE_EVERY);
  return { current, longest, freezes, days, milestones, freezeEvents, nextFreezeIn };
}

/**
 * The flame's look by streak length. The streak counts days without limit, so a new tier is
 * one more row here. Each tier holds from its day count until the next.
 */
export const FLAME_TIERS = [
  { from: 0, tier: "none" },
  { from: 1, tier: "yellow" },
  { from: 14, tier: "orange" },
  { from: 30, tier: "red" },
  { from: 90, tier: "blue" },
  { from: 180, tier: "purple" },
  { from: 365, tier: "gold" },
] as const;
export type FlameTier = (typeof FLAME_TIERS)[number]["tier"];

export function flameTier(days: number): FlameTier {
  let tier: FlameTier = "none";
  for (const t of FLAME_TIERS) if (days >= t.from) tier = t.tier;
  return tier;
}

/** What the learner has already been told about freezes, kept per browser. */
export type FreezeNoticesSeen = {
  /** The last used freeze (its day start) the learner was told about. */
  usedThrough: number | null;
  /** Whether the first freeze earned has been announced, or was too old to announce. */
  firstSeen: boolean;
};

export type FreezeNotice =
  | { kind: "used"; days: number; left: number; nextIn: number | null; through: number }
  | { kind: "first"; nextIn: number | null };

/** Freezes used or first earned longer ago than this are history, not news. */
export const FREEZE_NOTICE_WINDOW_DAYS = 7;

/**
 * The one freeze notice to show now, if any: freezes used since the last notice (the learner
 * missed a day and a freeze kept the streak), or else the first freeze ever earned. Events
 * older than a week are not news, so a restored backup or an old streak stays quiet.
 */
export function freezeNotice(
  streak: Pick<Streak, "freezeEvents" | "freezes" | "nextFreezeIn">,
  seen: FreezeNoticesSeen,
  now: number,
): FreezeNotice | null {
  const since = now - FREEZE_NOTICE_WINDOW_DAYS * 86_400_000;
  const used = streak.freezeEvents.filter(
    (e) =>
      e.kind === "used" &&
      e.day >= since &&
      (seen.usedThrough === null || e.day > seen.usedThrough),
  );
  const last = used.at(-1);
  if (last)
    return {
      kind: "used",
      days: used.length,
      left: streak.freezes,
      nextIn: streak.nextFreezeIn,
      through: last.day,
    };
  if (seen.firstSeen) return null;
  const first = streak.freezeEvents.find((e) => e.kind === "earned");
  if (first && first.day >= since) return { kind: "first", nextIn: streak.nextFreezeIn };
  return null;
}
