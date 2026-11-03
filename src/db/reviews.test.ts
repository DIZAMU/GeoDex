import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type GeoDexDb, type ReviewEvent } from "./db";
import {
  loadCardStates,
  rebuildCardStates,
  recordReview,
  resetProgress,
  schedulerFor,
} from "./reviews";
import { ensureSettings } from "./settings";

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

describe("reset progress", () => {
  it("keeps every event, replays only the ones after the reset, and reruns placement", async () => {
    await ensureSettings(db, "en");
    await db.settings.update("user", { placementCompletedAt: T0 });
    await recordReview(db, scheduler, review("NOR:map_to_name", T0, 3, "a"));
    await recordReview(db, scheduler, review("SWE:map_to_name", T0 + 1000, 3, "b"));
    await resetProgress(db, scheduler, T0 + 5000);
    expect(await db.reviewEvents.count()).toBe(2);
    expect((await loadCardStates(db)).size).toBe(0);
    const settings = await db.settings.get("user");
    expect(settings?.progressResetAt).toBe(T0 + 5000);
    expect(settings?.placementCompletedAt).toBeNull();

    await recordReview(db, scheduler, review("NOR:map_to_name", T0 + 9000, 3, "c"));
    expect([...(await loadCardStates(db)).keys()]).toEqual(["NOR:map_to_name"]);
    // A full rebuild agrees: only the review after the reset counts.
    await rebuildCardStates(db, scheduler);
    const states = await loadCardStates(db);
    expect(states.size).toBe(1);
    expect(states.get("NOR:map_to_name")?.reps).toBe(1);
  });
});

describe("schema v4", () => {
  it("drops the sync index and table and keeps every stored answer", async () => {
    const name = `v4-${counter}`;
    const old = new Dexie(name);
    old.version(3).stores({
      settings: "id",
      deviceSettings: "id",
      reviewEvents: "id, cardId, reviewedAt, synced",
      hookVoteEvents: "id, cardId, synced",
      cardState: "cardId, due",
      syncMeta: "table",
      placementProgress: "id",
    });
    await old.open();
    await old.table("reviewEvents").add({ ...review("NOR:map_to_name", T0, 3, "x"), synced: 1 });
    await old.table("syncMeta").add({ table: "reviewEvents", lastPullSeq: 7 });
    old.close();

    const upgraded = createDb(name);
    await upgraded.open();
    expect(upgraded.tables.map((t) => t.name)).not.toContain("syncMeta");
    expect(upgraded.reviewEvents.schema.indexes.map((i) => i.name)).not.toContain("synced");
    expect((await upgraded.reviewEvents.get("x"))?.cardId).toBe("NOR:map_to_name");
    await upgraded.delete();
  });
});
