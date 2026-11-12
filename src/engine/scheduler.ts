/**
 * FSRS scheduling on top of ts-fsrs. Card state is a pure function of the
 * card's scheduled review events, replayed in order, so every device computes the same state.
 */
import { type Card, createEmptyCard, type FSRS, fsrs, type Grade, State } from "ts-fsrs";
import { type CardId, DAY_MS, type ReviewEventCore } from "./types";

export type SchedulerParams = {
  requestRetention: number; // 0.80 to 0.95
  /** Personal FSRS weights; ts-fsrs defaults when absent. */
  w?: readonly number[];
};

export const DEFAULT_SCHEDULER_PARAMS: SchedulerParams = { requestRetention: 0.9 };

export type CardPhase = "new" | "learning" | "review" | "relearning";

/** Serializable FSRS state for one card. Cache only; rebuildable from events. */
export type CardState = {
  cardId: CardId;
  phase: CardPhase;
  due: number; // ms
  stability: number; // days
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: number | null; // ms
};

const PHASES: Record<State, CardPhase> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};
const STATES: Record<CardPhase, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

export function createScheduler(params: SchedulerParams = DEFAULT_SCHEDULER_PARAMS): FSRS {
  return fsrs({
    request_retention: params.requestRetention,
    // Fuzz would randomize intervals; replay must give identical results on every device.
    enable_fuzz: false,
    enable_short_term: true,
    ...(params.w ? { w: [...params.w] } : {}),
  });
}

function toState(cardId: CardId, card: Card): CardState {
  return {
    cardId,
    phase: PHASES[card.state],
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review ? card.last_review.getTime() : null,
  };
}

function toCard(state: CardState): Card {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: STATES[state.phase],
    ...(state.lastReview !== null ? { last_review: new Date(state.lastReview) } : {}),
  };
}

export function newCardState(cardId: CardId, now: number): CardState {
  return toState(cardId, createEmptyCard(new Date(now)));
}

const longTerm = new WeakMap<FSRS, FSRS>();

/**
 * The same scheduler without short-term learning steps. A correct placement answer goes
 * straight to review with a first interval of a few days, instead of the
 * 10 minute learning step that would bring it back on the same day.
 */
function longTermOf(scheduler: FSRS): FSRS {
  let derived = longTerm.get(scheduler);
  if (!derived) {
    derived = fsrs({ ...scheduler.parameters, enable_short_term: false });
    longTerm.set(scheduler, derived);
  }
  return derived;
}

/** Applies one review. Unscheduled events (drill, missed placement) leave the state unchanged. */
export function applyReview(
  scheduler: FSRS,
  state: CardState | null,
  event: Pick<ReviewEventCore, "cardId" | "reviewedAt" | "rating" | "scheduled" | "mode">,
): CardState | null {
  if (!event.scheduled) return state;
  const current = state ?? newCardState(event.cardId, event.reviewedAt);
  const seeding = event.mode === "placement" && current.phase === "new";
  const result = (seeding ? longTermOf(scheduler) : scheduler).next(
    toCard(current),
    new Date(event.reviewedAt),
    event.rating as Grade,
  );
  return toState(event.cardId, result.card);
}

/** Orders events the same way on every device: by time, then by id. */
export function compareEvents(a: ReviewEventCore, b: ReviewEventCore): number {
  return a.reviewedAt - b.reviewedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Card state from all of a card's events. Null when it has no scheduled review. */
export function replay(
  scheduler: FSRS,
  cardId: CardId,
  events: readonly ReviewEventCore[],
): CardState | null {
  let state: CardState | null = null;
  for (const event of [...events].filter((e) => e.cardId === cardId).sort(compareEvents)) {
    state = applyReview(scheduler, state, event);
  }
  return state;
}

/** Rebuilds every card's state from the full event log. */
export function replayAll(
  scheduler: FSRS,
  events: readonly ReviewEventCore[],
): Map<CardId, CardState> {
  const states = new Map<CardId, CardState>();
  for (const event of [...events].sort(compareEvents)) {
    const next = applyReview(scheduler, states.get(event.cardId) ?? null, event);
    if (next) states.set(event.cardId, next);
  }
  return states;
}

/** Probability of recall now, 0 for cards never reviewed. */
export function retrievability(scheduler: FSRS, state: CardState, now: number): number {
  if (state.phase === "new") return 0;
  return scheduler.get_retrievability(toCard(state), new Date(now), false);
}

export function isDue(state: CardState, now: number): boolean {
  return state.due <= now;
}

export function stabilityAtLeast(state: CardState | undefined, days: number): boolean {
  return state !== undefined && state.phase === "review" && state.stability >= days;
}

export function daysUntilDue(state: CardState, now: number): number {
  return (state.due - now) / DAY_MS;
}
