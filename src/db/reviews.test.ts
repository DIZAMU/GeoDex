import Dexie from "dexie";
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

describe("schema v3", () => {
  it("rebuilds a stale card state cache so placements seed a review interval", async () => {
    const name = `upgrade-${counter}`;
    const old = new Dexie(name);
    old.version(2).stores({
      settings: "id",
      deviceSettings: "id",
      reviewEvents: "id, cardId, reviewedAt, synced",
      hookVoteEvents: "id, cardId, synced",
      cardState: "cardId, due",
      syncMeta: "table",
      placementProgress: "id",
    });
    await old.open();
    await old
      .table("reviewEvents")
      .add({ ...review("ISL:map_to_name", T0, 3, "p"), mode: "placement" });
    await old
      .table("cardState")
      .add({ cardId: "ISL:map_to_name", phase: "learning", due: T0 + 600_000 });
    old.close();

    const upgraded = createDb(name);
    const state = await upgraded.cardState.get("ISL:map_to_name");
    expect(state?.phase).toBe("review");
    expect((state?.due ?? 0) - T0).toBeGreaterThanOrEqual(2 * 86_400_000);
    await upgraded.delete();
  });
});
