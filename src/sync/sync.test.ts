import { afterEach, describe, expect, it } from "vitest";
import {
  createDb,
  DEFAULT_SETTINGS,
  type GeoDexDb,
  type ReviewEvent,
  SETTINGS_ROW_ID,
} from "@/db/db";
import { loadCardStates, recordReview, schedulerFor } from "@/db/reviews";
import { createRng } from "@/engine/random";
import type { Rating } from "@/engine/types";
import { memoryBackend } from "./backend";
import { PULL_OVERLAP, syncOnce } from "./sync";

const scheduler = schedulerFor({ requestRetention: 0.9, fsrsParams: null });
const T0 = Date.UTC(2026, 3, 1, 8);
const CARDS = ["NOR:map_to_name", "SWE:map_to_name", "FIN:name_to_map", "DNK:flag_to_name"];
let counter = 0;
const dbs: GeoDexDb[] = [];

function device(): GeoDexDb {
  counter += 1;
  const db = createDb(`sync-${counter}`);
  dbs.push(db);
  return db;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

function review(
  id: string,
  cardId: string,
  at: number,
  rating: Rating,
  deviceId: string,
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
    responseMs: 2000,
    durationMs: 5000,
    snippetIds: [],
    scheduled: true,
    locale: "en",
    deviceId,
    synced: 0,
  };
}

async function snapshot(db: GeoDexDb) {
  const events = (await db.reviewEvents.toArray())
    .map(({ synced: _s, ...e }) => e)
    .sort((a, b) => a.id.localeCompare(b.id));
  const votes = (await db.hookVoteEvents.toArray())
    .map(({ synced: _s, ...v }) => v)
    .sort((a, b) => a.id.localeCompare(b.id));
  const states = [...(await loadCardStates(db)).entries()].sort();
  return { events, votes, states };
}

describe("sync", () => {
  it("converges two devices that review and vote offline in any interleaving", async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const rng = createRng(`sync-${seed}`);
      const server = memoryBackend();
      const devices = [device(), device()];
      let n = 0;
      let clock = T0;
      for (let step = 0; step < 60; step++) {
        const index = Math.floor(rng() * 2);
        const db = devices[index] as GeoDexDb;
        const roll = rng();
        clock += Math.floor(rng() * 6 * 3_600_000);
        if (roll < 0.6) {
          n += 1;
          const card = CARDS[Math.floor(rng() * CARDS.length)] as string;
          const rating = (1 + Math.floor(rng() * 4)) as Rating;
          await recordReview(
            db,
            scheduler,
            review(`r${seed}-${n}`, card, clock, rating, `d${index}`),
          );
        } else if (roll < 0.7) {
          n += 1;
          await db.hookVoteEvents.add({
            id: `v${seed}-${n}`,
            cardId: CARDS[0] as string,
            hookId: `NOR.en.${n % 3}`,
            createdAt: clock,
            deviceId: `d${index}`,
            synced: 0,
          });
        } else {
          await syncOnce(db, server.backend, scheduler);
        }
      }
      for (const db of [...devices, ...devices]) await syncOnce(db, server.backend, scheduler);
      const [a, b] = await Promise.all(devices.map(snapshot));
      expect(a, `seed ${seed}`).toEqual(b);
      expect(a?.events.length).toBe(server.reviews.length);
      for (const db of devices.splice(0)) await db.delete();
    }
  });

  it("is idempotent when the same events are pushed twice", async () => {
    const server = memoryBackend();
    const db = device();
    await recordReview(db, scheduler, review("a", "NOR:map_to_name", T0, 3, "d"));
    await syncOnce(db, server.backend, scheduler);
    // A crash after pushing but before marking: the events are pushed again.
    await db.reviewEvents.update("a", { synced: 0 });
    await syncOnce(db, server.backend, scheduler);
    await syncOnce(db, server.backend, scheduler);
    expect(server.reviews).toHaveLength(1);
    expect(await db.reviewEvents.count()).toBe(1);
  });

  it("pulls with an overlap and never duplicates what it already has", async () => {
    const server = memoryBackend();
    const [a, b] = [device(), device()];
    for (let i = 0; i < PULL_OVERLAP + 20; i++) {
      await recordReview(a, scheduler, review(`e${i}`, "SWE:map_to_name", T0 + i * 60_000, 3, "a"));
    }
    await syncOnce(a, server.backend, scheduler);
    await syncOnce(b, server.backend, scheduler);
    await syncOnce(b, server.backend, scheduler);
    expect(await b.reviewEvents.count()).toBe(PULL_OVERLAP + 20);
    expect((await b.syncMeta.get("reviewEvents"))?.lastPullSeq).toBe(PULL_OVERLAP + 20);
  });

  it("settles settings by last write wins", async () => {
    const server = memoryBackend();
    const [a, b] = [device(), device()];
    const row = (updatedAt: number, dailyMinutes: number) => ({
      id: SETTINGS_ROW_ID as typeof SETTINGS_ROW_ID,
      locale: "en" as const,
      ...DEFAULT_SETTINGS,
      dailyMinutes,
      updatedAt,
    });
    await a.settings.put(row(T0 + 10, 30));
    await b.settings.put(row(T0 + 5, 10));
    expect((await syncOnce(b, server.backend, scheduler)).settings).toBe("pushed");
    expect((await syncOnce(a, server.backend, scheduler)).settings).toBe("pushed");
    expect((await syncOnce(b, server.backend, scheduler)).settings).toBe("pulled");
    expect((await b.settings.get(SETTINGS_ROW_ID))?.dailyMinutes).toBe(30);
  });
});
