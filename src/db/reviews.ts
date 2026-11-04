/**
 * Review events and the card state cache. Events are append-only; card state is derived
 * from them and can be rebuilt at any time (CONTRIBUTING.md invariants 1 and 2).
 */
import type { FSRS } from "ts-fsrs";
import { eventsSince } from "@/engine/reset";
import { applyReview, type CardState, createScheduler, replayAll } from "@/engine/scheduler";
import type { CardId } from "@/engine/types";
import { type GeoDexDb, type ReviewEvent, SETTINGS_ROW_ID, type SettingsRow } from "./db";

/** When progress was last reset, if ever. Events up to then are not replayed. */
async function resetTime(db: GeoDexDb): Promise<number | null> {
  return (await db.settings.get(SETTINGS_ROW_ID))?.progressResetAt ?? null;
}

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
  return db.transaction("rw", db.reviewEvents, db.cardState, db.settings, async () => {
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
  const events = eventsSince(
    await db.reviewEvents.where("cardId").equals(cardId).toArray(),
    await resetTime(db),
  );
  const state = replayAll(scheduler, events).get(cardId) ?? null;
  if (state) await db.cardState.put(state);
  else await db.cardState.delete(cardId);
  return state;
}

/** Throws away the cache and replays every event. Used after sync and settings changes. */
export async function rebuildCardStates(db: GeoDexDb, scheduler: FSRS): Promise<number> {
  return db.transaction("rw", db.reviewEvents, db.cardState, db.settings, async () => {
    const states = replayAll(
      scheduler,
      eventsSince(await db.reviewEvents.toArray(), await resetTime(db)),
    );
    await db.cardState.clear();
    await db.cardState.bulkPut([...states.values()]);
    return states.size;
  });
}

export async function loadCardStates(db: GeoDexDb): Promise<Map<CardId, CardState>> {
  return new Map((await db.cardState.toArray()).map((state) => [state.cardId, state]));
}

/**
 * Starts over: progress, streak and stats count only reviews from now on. Nothing is
 * deleted: the events stay in the log and in backups made before.
 */
export async function resetProgress(db: GeoDexDb, scheduler: FSRS, now = Date.now()) {
  await db.settings.update(SETTINGS_ROW_ID, { progressResetAt: now, updatedAt: now });
  await rebuildCardStates(db, scheduler);
}
