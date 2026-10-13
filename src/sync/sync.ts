/**
 * The sync engine (PLAN.md 5.6). Pushes unsynced events, pulls by server sequence with an
 * overlap so late-visible rows are never missed, dedupes by id, and settles settings by last
 * write wins. Events are never changed or deleted; only the local `synced` flag moves.
 */
import type { FSRS } from "ts-fsrs";
import { type GeoDexDb, SETTINGS_ROW_ID, type SettingsRow } from "@/db/db";
import { rebuildCardStates, schedulerFor } from "@/db/reviews";
import type { Sequenced, SyncBackend, WireReview, WireVote } from "./backend";

export const PUSH_BATCH = 500;
export const PULL_PAGE = 500;
/** Pull starts this many sequence numbers back: identity values can become visible out of order. */
export const PULL_OVERLAP = 500;

export type SyncResult = { pushed: number; pulled: number; settings: "kept" | "pulled" | "pushed" };

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function pushAll(db: GeoDexDb, backend: SyncBackend): Promise<number> {
  let pushed = 0;
  const reviews = await db.reviewEvents.where("synced").equals(0).toArray();
  for (const batch of chunks(reviews, PUSH_BATCH)) {
    await backend.pushReviews(batch.map(({ synced: _s, ...wire }) => wire));
    await db.reviewEvents.bulkUpdate(batch.map((e) => ({ key: e.id, changes: { synced: 1 } })));
    pushed += batch.length;
  }
  const votes = await db.hookVoteEvents.where("synced").equals(0).toArray();
  for (const batch of chunks(votes, PUSH_BATCH)) {
    await backend.pushVotes(batch.map(({ synced: _s, ...wire }) => wire));
    await db.hookVoteEvents.bulkUpdate(batch.map((e) => ({ key: e.id, changes: { synced: 1 } })));
    pushed += batch.length;
  }
  return pushed;
}

async function pullTable<T extends { id: string }>(
  db: GeoDexDb,
  name: "reviewEvents" | "hookVoteEvents",
  fetch: (afterSeq: number, limit: number) => Promise<Sequenced<T>[]>,
  store: (rows: T[]) => Promise<void>,
  has: (ids: string[]) => Promise<Set<string>>,
): Promise<number> {
  const meta = await db.syncMeta.get(name);
  let after = Math.max(0, (meta?.lastPullSeq ?? 0) - PULL_OVERLAP);
  let maxSeq = meta?.lastPullSeq ?? 0;
  let added = 0;
  for (;;) {
    const page = await fetch(after, PULL_PAGE);
    if (page.length === 0) break;
    const known = await has(page.map((r) => r.id));
    const fresh = page
      .filter((r) => !known.has(r.id))
      .map(({ seq: _seq, ...row }) => row as unknown as T);
    if (fresh.length > 0) await store(fresh);
    added += fresh.length;
    after = page[page.length - 1]?.seq ?? after;
    maxSeq = Math.max(maxSeq, after);
    if (page.length < PULL_PAGE) break;
  }
  await db.syncMeta.put({ table: name, lastPullSeq: maxSeq });
  return added;
}

async function existing(db: GeoDexDb, table: "reviewEvents" | "hookVoteEvents", ids: string[]) {
  const rows = await db.table(table).bulkGet(ids);
  return new Set(rows.filter(Boolean).map((r: { id: string }) => r.id));
}

/** Last write wins on the whole settings row, by `updatedAt`. */
async function syncSettings(db: GeoDexDb, backend: SyncBackend): Promise<SyncResult["settings"]> {
  const local = await db.settings.get(SETTINGS_ROW_ID);
  const remote = await backend.getSettings();
  if (remote && (!local || remote.updatedAt > local.updatedAt)) {
    await db.settings.put({ ...remote, id: SETTINGS_ROW_ID } as SettingsRow);
    return "pulled";
  }
  if (local && (!remote || local.updatedAt > remote.updatedAt)) {
    const { id: _id, ...wire } = local;
    await backend.putSettings(wire);
    return "pushed";
  }
  return "kept";
}

/** One full sync. Safe to repeat: every step is idempotent. */
export async function syncOnce(
  db: GeoDexDb,
  backend: SyncBackend,
  scheduler?: FSRS,
): Promise<SyncResult> {
  const pushed = await pushAll(db, backend);
  const settings = await syncSettings(db, backend);
  const pulledReviews = await pullTable<WireReview>(
    db,
    "reviewEvents",
    (after, limit) => backend.pullReviews(after, limit),
    async (rows) => {
      await db.reviewEvents.bulkAdd(rows.map((r) => ({ ...r, synced: 1 as const })));
    },
    (ids) => existing(db, "reviewEvents", ids),
  );
  const pulledVotes = await pullTable<WireVote>(
    db,
    "hookVoteEvents",
    (after, limit) => backend.pullVotes(after, limit),
    async (rows) => {
      await db.hookVoteEvents.bulkAdd(rows.map((r) => ({ ...r, synced: 1 as const })));
    },
    (ids) => existing(db, "hookVoteEvents", ids),
  );
  // New events, or settings that change scheduling, mean the card cache is stale.
  if (pulledReviews > 0 || settings === "pulled") {
    const row = await db.settings.get(SETTINGS_ROW_ID);
    await rebuildCardStates(
      db,
      scheduler && settings !== "pulled"
        ? scheduler
        : schedulerFor({
            requestRetention: row?.requestRetention ?? 0.9,
            fsrsParams: row?.fsrsParams ?? null,
          }),
    );
  }
  return { pushed, pulled: pulledReviews + pulledVotes, settings };
}
