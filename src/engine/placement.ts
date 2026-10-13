/**
 * Placement test (PLAN.md 6.4). Adaptive by subregion: two probe questions decide whether
 * to test the whole subregion. Correct answers seed scheduling; misses are logged
 * unscheduled so they feed confusion tracking only.
 */
import { createRng, shuffle } from "./random";
import { type CardId, type CountryCardType, cardId } from "./types";

export const PLACEMENT_MAX_QUESTIONS = 120;
export const PLACEMENT_MAX_MS = 15 * 60_000;

export type PlacementKind = "probe" | "country" | "capital" | "flag";
export type PlacementQuestion = {
  cardId: CardId;
  entityId: string;
  subregion: string;
  kind: PlacementKind;
};
export type SubregionOutcome = "known" | "partial" | "unknown" | "skipped";

export type PlacementState = {
  order: string[];
  index: number;
  queue: PlacementQuestion[];
  probes: string[]; // probe entities of the current subregion
  probeResults: boolean[];
  correct: string[]; // entities placed correctly in the current subregion
  asked: number;
  startedAt: number;
  seed: string;
  members: Record<string, string[]>;
  outcomes: Record<string, SubregionOutcome>;
  done: boolean;
};

const CARD_FOR: Record<PlacementKind, CountryCardType> = {
  probe: "map_to_name",
  country: "map_to_name",
  capital: "country_to_capital",
  flag: "flag_to_name",
};

function question(entityId: string, subregion: string, kind: PlacementKind): PlacementQuestion {
  return { cardId: cardId(entityId, CARD_FOR[kind]), entityId, subregion, kind };
}

function enterSubregion(state: PlacementState, index: number): PlacementState {
  const subregion = state.order[index];
  if (subregion === undefined) return { ...state, index, queue: [], done: true };
  const members = state.members[subregion] ?? [];
  const probes = shuffle(members, createRng(`${state.seed}:${subregion}`)).slice(0, 2);
  return {
    ...state,
    index,
    queue: probes.map((id) => question(id, subregion, "probe")),
    probes,
    probeResults: [],
    correct: [],
  };
}

export function startPlacement(input: {
  order: readonly string[];
  members: Record<string, readonly string[]>;
  startedAt: number;
  seed: string;
}): PlacementState {
  const members = Object.fromEntries(
    Object.entries(input.members).map(([k, v]) => [k, [...v].sort()]),
  );
  return enterSubregion(
    {
      order: input.order.filter((id) => (members[id]?.length ?? 0) > 0),
      index: 0,
      queue: [],
      probes: [],
      probeResults: [],
      correct: [],
      asked: 0,
      startedAt: input.startedAt,
      seed: input.seed,
      members,
      outcomes: {},
      done: false,
    },
    0,
  );
}

export function currentQuestion(state: PlacementState): PlacementQuestion | null {
  return state.done ? null : (state.queue[0] ?? null);
}

function finishSubregion(state: PlacementState, outcome: SubregionOutcome): PlacementState {
  const subregion = state.order[state.index] ?? "";
  return enterSubregion(
    { ...state, outcomes: { ...state.outcomes, [subregion]: outcome } },
    state.index + 1,
  );
}

/** Records an answer to the current question and advances. */
export function answerPlacement(
  state: PlacementState,
  correct: boolean,
  now: number,
): PlacementState {
  const asked = currentQuestion(state);
  if (!asked) return state;
  let next: PlacementState = {
    ...state,
    queue: state.queue.slice(1),
    asked: state.asked + 1,
    correct:
      correct && (asked.kind === "probe" || asked.kind === "country")
        ? [...state.correct, asked.entityId]
        : state.correct,
    probeResults: asked.kind === "probe" ? [...state.probeResults, correct] : state.probeResults,
  };

  if (next.asked >= PLACEMENT_MAX_QUESTIONS || now - next.startedAt >= PLACEMENT_MAX_MS) {
    return { ...next, queue: [], done: true };
  }
  if (next.queue.length > 0) return next;

  const subregion = asked.subregion;
  if (asked.kind === "probe") {
    if (next.probeResults.every((r) => !r)) return finishSubregion(next, "unknown");
    // At least one probe was right: test the rest of the subregion.
    const rest = (state.members[subregion] ?? []).filter((id) => !next.probes.includes(id));
    next = { ...next, queue: rest.map((id) => question(id, subregion, "country")) };
    if (next.queue.length > 0) return next;
  }
  if (asked.kind === "probe" || asked.kind === "country") {
    next = { ...next, queue: next.correct.map((id) => question(id, subregion, "capital")) };
    if (next.queue.length > 0) return next;
  }
  if (asked.kind !== "flag") {
    next = { ...next, queue: next.correct.map((id) => question(id, subregion, "flag")) };
    if (next.queue.length > 0) return next;
  }
  const allProbes = next.probeResults.length > 0 && next.probeResults.every(Boolean);
  return finishSubregion(next, allProbes ? "known" : "partial");
}

/** Skips the rest of the current subregion. */
export function skipSubregion(state: PlacementState): PlacementState {
  if (state.done) return state;
  return finishSubregion(state, "skipped");
}

/** The review event fields for a placement answer (PLAN.md 6.4). */
export function placementReview(correct: boolean): {
  rating: 1 | 3;
  scheduled: boolean;
  mode: "placement";
} {
  return { rating: correct ? 3 : 1, scheduled: correct, mode: "placement" };
}
