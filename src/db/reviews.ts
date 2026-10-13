/**
 * Review events and the card state cache. Events are append-only; card state is derived
 * from them and can be rebuilt at any time (CONTRIBUTING.md invariants 1 and 2).
 */
import type { FSRS } from "ts-fsrs";
import { applyReview, type CardState, createScheduler, replayAll } from "@/engine/scheduler";
import type { CardId } from "@/engine/types";
import type { GeoDexDb, ReviewEvent, SettingsRow } from "./db";

export function schedulerFor(settings: Pick<SettingsRow, "requestRetention" | "fsrsParams">): FSRS {
  return createScheduler({
    requestRetention: settings.requestRetention,
    ...(settings.fsrsParams ? { w: settings.fsrsParams } : {}),
  });
}

/**
 * Appends one review event and updates the cached state of its card. If the event is
 * older than the card's last review (it arrived late), the card is replayed in full.
 */
export async function recordReview(
  db: GeoDexDb,
  scheduler: FSRS,
  event: ReviewEvent,
): Promise<CardState | null> {
  return db.transaction("rw", db.reviewEvents, db.cardState, async () => {
    await db.reviewEvents.add(event);
    const cached = (await db.cardState.get(event.cardId)) ?? null;
    if (cached?.lastReview != null && event.reviewedAt < cached.lastReview) {
      return rebuildCard(db, scheduler, event.cardId);
    }
    const next = applyReview(scheduler, cached, event);
    if (next) await db.cardState.put(next);
    return next;
  });
}

async function rebuildCard(
  db: GeoDexDb,
  scheduler: FSRS,
  cardId: CardId,
): Promise<CardState | null> {
  const events = await db.reviewEvents.where("cardId").equals(cardId).toArray();
  const state = replayAll(scheduler, events).get(cardId) ?? null;
  if (state) await db.cardState.put(state);
  else await db.cardState.delete(cardId);
  return state;
}

/** Throws away the cache and replays every event. Used after sync and settings changes. */
export async function rebuildCardStates(db: GeoDexDb, scheduler: FSRS): Promise<number> {
  return db.transaction("rw", db.reviewEvents, db.cardState, async () => {
    const states = replayAll(scheduler, await db.reviewEvents.toArray());
    await db.cardState.clear();
    await db.cardState.bulkPut([...states.values()]);
    return states.size;
  });
}

export async function loadCardStates(db: GeoDexDb): Promise<Map<CardId, CardState>> {
  return new Map((await db.cardState.toArray()).map((state) => [state.cardId, state]));
}
