import { afterEach, describe, expect, it } from "vitest";
import { exportData, importData, parseBackup } from "./backup";
import { createDb, type GeoDexDb } from "./db";
import { loadCardStates, recordReview, schedulerFor } from "./reviews";

const scheduler = schedulerFor({ requestRetention: 0.9, fsrsParams: null });
const T0 = Date.UTC(2026, 4, 1, 9);
let n = 0;
const dbs: GeoDexDb[] = [];
const fresh = () => {
  n += 1;
  const db = createDb(`backup-${n}`);
  dbs.push(db);
  return db;
};
afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

describe("backup", () => {
  it("round-trips events and rebuilds the same card states, and imports idempotently", async () => {
    const a = fresh();
    for (let i = 0; i < 6; i++) {
      await recordReview(a, scheduler, {
        id: `e${i}`,
        cardId: i % 2 ? "NOR:map_to_name" : "SWE:map_to_name",
        reviewedAt: T0 + i * 86_400_000,
        rating: (1 + (i % 4)) as 1 | 2 | 3 | 4,
        mode: "mc",
        inputSetting: "auto",
        correct: i % 4 !== 0,
        chosenAnswer: null,
        responseMs: 2000,
        durationMs: 5000,
        snippetIds: ["t:correct.region"],
        scheduled: true,
        locale: "en",
        deviceId: "a",
        synced: 1,
      });
    }
    await a.hookVoteEvents.add({
      id: "v1",
      cardId: "NOR:map_to_name",
      hookId: "NOR.en.1",
      createdAt: T0,
      deviceId: "a",
      synced: 1,
    });
    const text = JSON.stringify(await exportData(a, T0));

    const b = fresh();
    expect(await importData(b, parseBackup(text), scheduler)).toEqual({ reviews: 6, votes: 1 });
    expect(await importData(b, parseBackup(text), scheduler)).toEqual({ reviews: 0, votes: 0 });
    expect([...(await loadCardStates(b)).entries()].sort()).toEqual(
      [...(await loadCardStates(a)).entries()].sort(),
    );
    // Imported events still need to reach the server.
    expect(await b.reviewEvents.where("synced").equals(0).count()).toBe(6);
  });

  it("rejects files that are not a GeoDex backup", () => {
    expect(() => parseBackup("not json")).toThrow();
    expect(() => parseBackup(JSON.stringify({ format: "other" }))).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          format: "geodex-backup",
          version: 1,
          reviewEvents: [{}],
          hookVoteEvents: [],
        }),
      ),
    ).toThrow();
  });
});
