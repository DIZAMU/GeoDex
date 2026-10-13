/** Session composition and order (PLAN.md 6.3). */
import { haversineKm, sphericalMean } from "./geo";
import type { CardState } from "./scheduler";
import type { CardId } from "./types";

export type QueueItem = {
  cardId: CardId;
  entityId: string;
  subregion: string;
  isNew: boolean;
};

/** At most this many review cards in a row from the same subregion. */
export const MAX_SAME_SUBREGION_RUN = 2;
/** Learning steps due within this window come back in the same session. */
export const LEARNING_REQUEUE_WINDOW_MS = 30 * 60_000;

/** Subregions ordered from the home country outward by distance between their centers. */
export function subregionOrder(
  homeCountryId: string,
  countries: readonly { id: string; subregion: string; centroid: readonly [number, number] }[],
): string[] {
  const groups = new Map<string, [number, number][]>();
  for (const c of countries) {
    const list = groups.get(c.subregion) ?? [];
    list.push([c.centroid[0], c.centroid[1]]);
    groups.set(c.subregion, list);
  }
  const centers = new Map([...groups].map(([id, points]) => [id, sphericalMean(points)]));
  const home = countries.find((c) => c.id === homeCountryId)?.subregion;
  const origin = (home && centers.get(home)) || [0, 0];
  return [...centers]
    .map(([id, [lon, lat]]) => ({
      id,
      distance: id === home ? -1 : haversineKm(origin[0], origin[1], lon, lat),
    }))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .map((x) => x.id);
}

/**
 * Picks today's new cards: newly unlocked stages of entities already started come first,
 * then new entities subregion by subregion in the given order, so a batch finishes before
 * the next starts.
 */
export function pickNewCards(
  candidates: readonly (QueueItem & { stage: number; introduced: boolean })[],
  order: readonly string[],
  limit: number,
): QueueItem[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  const sorted = [...candidates].sort(
    (a, b) =>
      Number(a.introduced === false) - Number(b.introduced === false) ||
      (rank.get(a.subregion) ?? 999) - (rank.get(b.subregion) ?? 999) ||
      a.stage - b.stage ||
      a.cardId.localeCompare(b.cardId),
  );
  return sorted.slice(0, Math.max(0, limit)).map(({ cardId, entityId, subregion }) => ({
    cardId,
    entityId,
    subregion,
    isNew: true,
  }));
}

function differentEntity(item: QueueItem, recent: readonly QueueItem[]): boolean {
  return recent[recent.length - 1]?.entityId !== item.entityId;
}

function fits(item: QueueItem, recent: readonly QueueItem[]): boolean {
  if (!differentEntity(item, recent)) return false;
  if (!item.isNew) {
    const run = recent.slice(-MAX_SAME_SUBREGION_RUN);
    if (
      run.length === MAX_SAME_SUBREGION_RUN &&
      run.every((r) => !r.isNew && r.subregion === item.subregion)
    ) {
      return false;
    }
  }
  return true;
}

/** Greedy order that keeps the given priority while honoring the interleaving rules. */
export function arrange(
  items: readonly QueueItem[],
  recent: readonly QueueItem[] = [],
): QueueItem[] {
  const remaining = [...items];
  const result: QueueItem[] = [];
  const history = [...recent];
  while (remaining.length > 0) {
    let index = remaining.findIndex((item) => fits(item, history));
    // The subregion rule gives way first; the entity rule only when nothing else is left.
    if (index < 0) index = remaining.findIndex((item) => differentEntity(item, history));
    if (index < 0) index = 0;
    const [item] = remaining.splice(index, 1);
    if (!item) break;
    result.push(item);
    history.push(item);
  }
  return result;
}

/**
 * Today's queue: due cards by lowest retrievability first, with new cards spread evenly
 * among them, then arranged so no entity repeats back to back and no more than two review
 * cards in a row share a subregion.
 */
export function buildQueue(
  due: readonly (QueueItem & { retrievability: number })[],
  fresh: readonly QueueItem[],
): QueueItem[] {
  const reviews = [...due]
    .sort((a, b) => a.retrievability - b.retrievability || a.cardId.localeCompare(b.cardId))
    .map(({ retrievability: _r, ...item }) => item);
  const merged: QueueItem[] = [];
  const gap = fresh.length > 0 ? reviews.length / fresh.length : 0;
  let nextNewAt = gap / 2;
  let freshIndex = 0;
  for (let i = 0; i < reviews.length; i++) {
    while (freshIndex < fresh.length && i >= nextNewAt) {
      merged.push(fresh[freshIndex] as QueueItem);
      freshIndex++;
      nextNewAt += gap;
    }
    merged.push(reviews[i] as QueueItem);
  }
  merged.push(...fresh.slice(freshIndex));
  return arrange(merged);
}

/** A running session: the queue plus learning steps waiting to come back. */
export type SessionState = {
  queue: QueueItem[];
  pending: { item: QueueItem; due: number }[];
  recent: QueueItem[];
  answered: number;
};

export function startSession(queue: QueueItem[]): SessionState {
  return { queue, pending: [], recent: [], answered: 0 };
}

export function remaining(state: SessionState): number {
  return state.queue.length + state.pending.length;
}

/** The next card to show, and the state with it removed. Null when the session is done. */
export function nextItem(
  state: SessionState,
  now: number,
): { item: QueueItem; state: SessionState } | null {
  const take = (from: "queue" | "pending", index: number) => {
    const queue = [...state.queue];
    const pending = [...state.pending];
    const item = from === "queue" ? queue.splice(index, 1)[0] : pending.splice(index, 1)[0]?.item;
    if (!item) return null;
    return { item, state: { ...state, queue, pending, recent: [...state.recent, item].slice(-4) } };
  };

  const ready = state.pending
    .map((p, index) => ({ ...p, index }))
    .filter((p) => p.due <= now && fits(p.item, state.recent))
    .sort((a, b) => a.due - b.due);
  if (ready[0]) return take("pending", ready[0].index);

  const queued = state.queue.findIndex((item) => fits(item, state.recent));
  if (queued >= 0) return take("queue", queued);
  const otherEntity = state.queue.findIndex((item) => differentEntity(item, state.recent));
  if (otherEntity >= 0) return take("queue", otherEntity);
  if (state.queue.length > 0) return take("queue", 0);

  if (state.pending.length > 0) {
    const earliest = state.pending
      .map((p, index) => ({ ...p, index }))
      .sort((a, b) => a.due - b.due)[0];
    return earliest ? take("pending", earliest.index) : null;
  }
  return null;
}

/** Records an answer; learning steps due soon come back later in the same session. */
export function afterAnswer(
  state: SessionState,
  item: QueueItem,
  cardState: CardState | null,
  now: number,
): SessionState {
  const next = { ...state, answered: state.answered + 1 };
  const learning =
    cardState && (cardState.phase === "learning" || cardState.phase === "relearning");
  if (learning && cardState.due - now <= LEARNING_REQUEUE_WINDOW_MS) {
    next.pending = [...state.pending, { item: { ...item, isNew: false }, due: cardState.due }];
  }
  return next;
}
