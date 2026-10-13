import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type GeoDexDb, type ReviewEvent } from "./db";
import { loadCardStates, rebuildCardStates, recordReview, schedulerFor } from "./reviews";

let db: GeoDexDb;
let counter = 0;
const scheduler = schedulerFor({ requestRetention: 0.9, fsrsParams: null });
const T0 = Date.UTC(2026, 2, 1, 9);

function review(
  cardId: string,
  at: number,
  rating: 1 | 2 | 3 | 4,
  id: string,
  scheduled = true,
): ReviewEvent {
  return {
    id,
    cardId,
    reviewedAt: at,
    rating,
    mode: "mc",
    inputSetting: "auto",
    correct: rating > 1,
    chosenAnswer: null,
    responseMs: 2500,
    durationMs: 6000,
    snippetIds: [],
    scheduled,
    locale: "en",
    deviceId: "test",
    synced: 0,
  };
}

beforeEach(() => {
  counter += 1;
  db = createDb(`reviews-${counter}`);
});
afterEach(async () => {
  await db.delete();
});

describe("review events and card state", () => {
  it("appends events and keeps the cache equal to a full rebuild", async () => {
    const events = [
      review("NOR:map_to_name", T0, 3, "a"),
      review("NOR:map_to_name", T0 + 600_000, 3, "b"),
      review("SWE:map_to_name", T0 + 700_000, 1, "c"),
      review("NOR:map_to_name", T0 + 3 * 86_400_000, 2, "d"),
      review("SWE:map_to_name", T0 + 800_000, 4, "e", false),
    ];
    for (const e of events) await recordReview(db, scheduler, e);
    const cached = await loadCardStates(db);

    await rebuildCardStates(db, scheduler);
    expect(await loadCardStates(db)).toEqual(cached);
    expect(await db.reviewEvents.count()).toBe(5);
  });

  it("replays a card when an older event arrives late", async () => {
    await recordReview(db, scheduler, review("FIN:map_to_name", T0 + 86_400_000, 3, "late-2"));
    await recordReview(db, scheduler, review("FIN:map_to_name", T0, 1, "late-1"));
    const incremental = await loadCardStates(db);
    await rebuildCardStates(db, scheduler);
    expect(await loadCardStates(db)).toEqual(incremental);
  });

  it("rejects a duplicate event id instead of overwriting it", async () => {
    await recordReview(db, scheduler, review("DNK:map_to_name", T0, 3, "dup"));
    await expect(
      recordReview(db, scheduler, review("DNK:map_to_name", T0 + 1, 1, "dup")),
    ).rejects.toThrow();
    expect((await db.reviewEvents.get("dup"))?.rating).toBe(3);
  });
});
