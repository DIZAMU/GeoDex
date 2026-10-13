/** Numbers for the Stats screen (PLAN.md 8.3). Pure functions of events and card states. */
import { isMastered, SKILL_IDS, SKILLS, type Skill } from "./achievements";
import { learningDay } from "./day";
import { LEECH_LAPSES } from "./explain/select";
import { type CardState, compareEvents } from "./scheduler";
import { parseCardId, type ReviewEventCore } from "./types";

export type DayCount = { start: number; count: number };

function dayStarts(now: number, dayStartHour: number, count: number, forward: boolean): number[] {
  const out: number[] = [];
  let start = learningDay(now, dayStartHour).start;
  for (let i = 0; i < count; i++) {
    out.push(start);
    const probe = forward ? start + 36 * 3_600_000 : start - 12 * 3_600_000;
    start = learningDay(probe, dayStartHour).start;
  }
  return forward ? out : out.reverse();
}

const isStudy = (e: ReviewEventCore) => e.scheduled && e.mode !== "placement";

/** Scheduled reviews per learning day for the last `days` days, oldest first. */
export function activity(
  events: readonly ReviewEventCore[],
  now: number,
  dayStartHour: number,
  days = 365,
): DayCount[] {
  const starts = dayStarts(now, dayStartHour, days, false);
  const counts = new Map(starts.map((s) => [s, 0]));
  for (const e of events) {
    if (!isStudy(e)) continue;
    const start = learningDay(e.reviewedAt, dayStartHour).start;
    if (counts.has(start)) counts.set(start, (counts.get(start) ?? 0) + 1);
  }
  return starts.map((start) => ({ start, count: counts.get(start) ?? 0 }));
}

/**
 * Retention per day: the share of reviews answered correctly among cards that had been
 * reviewed before (first exposures are learning, not recall).
 */
export function retention(
  events: readonly ReviewEventCore[],
  now: number,
  dayStartHour: number,
  days = 30,
): { start: number; total: number; correct: number }[] {
  const starts = dayStarts(now, dayStartHour, days, false);
  const rows = new Map(starts.map((s) => [s, { start: s, total: 0, correct: 0 }]));
  const seen = new Set<string>();
  for (const e of [...events].sort(compareEvents)) {
    if (!e.scheduled) continue;
    const first = !seen.has(e.cardId);
    seen.add(e.cardId);
    if (first || e.mode === "placement") continue;
    const row = rows.get(learningDay(e.reviewedAt, dayStartHour).start);
    if (!row) continue;
    row.total++;
    if (e.correct) row.correct++;
  }
  return starts.map((s) => rows.get(s) as { start: number; total: number; correct: number });
}

/** Cards coming due per day for the next `days` days; today includes everything overdue. */
export function forecast(
  states: Iterable<CardState>,
  now: number,
  dayStartHour: number,
  days = 30,
): DayCount[] {
  const starts = dayStarts(now, dayStartHour, days, true);
  const counts = starts.map((start) => ({ start, count: 0 }));
  const last = learningDay(starts[starts.length - 1] ?? now, dayStartHour).end;
  for (const s of states) {
    if (s.phase === "new" || s.due >= last) continue;
    const index = s.due < (starts[1] ?? last) ? 0 : starts.findLastIndex((start) => start <= s.due);
    const row = counts[index];
    if (row) row.count++;
  }
  return counts;
}

export type GridCell = { total: number; started: number; mastered: number };

/** Skill x continent: how many cards exist, have been studied, and are mastered. */
export function skillGrid(
  countries: readonly { id: string; continent: string }[],
  states: ReadonlyMap<string, CardState>,
  skills: readonly Skill[] = SKILL_IDS,
): Map<Skill, Map<string, GridCell>> {
  const grid = new Map<Skill, Map<string, GridCell>>();
  for (const skill of skills) {
    const row = new Map<string, GridCell>();
    for (const c of countries) {
      const cell = row.get(c.continent) ?? { total: 0, started: 0, mastered: 0 };
      for (const type of SKILLS[skill]) {
        const state = states.get(`${c.id}:${type}`);
        cell.total++;
        if (state && state.phase !== "new") cell.started++;
        if (isMastered(state)) cell.mastered++;
      }
      row.set(c.continent, cell);
    }
    grid.set(skill, row);
  }
  return grid;
}

export function leeches(states: Iterable<CardState>): CardState[] {
  return [...states]
    .filter((s) => s.lapses >= LEECH_LAPSES)
    .sort((a, b) => b.lapses - a.lapses || a.cardId.localeCompare(b.cardId));
}

/**
 * Recognition without recall: countries the learner recognizes on the map (map_to_name
 * stable for a week or more) but cannot yet place from the name (name_to_map below that).
 */
export function recognitionOnly(states: ReadonlyMap<string, CardState>): {
  count: number;
  of: number;
  ids: string[];
} {
  const WEEK = 7;
  const ids: string[] = [];
  let of = 0;
  for (const s of states.values()) {
    const { entityId, type } = parseCardId(s.cardId);
    if (type !== "map_to_name" || s.phase !== "review" || s.stability < WEEK) continue;
    of++;
    const recall = states.get(`${entityId}:name_to_map`);
    if (!recall || recall.phase === "new" || recall.stability < WEEK) ids.push(entityId);
  }
  return { count: ids.length, of, ids: ids.sort() };
}
