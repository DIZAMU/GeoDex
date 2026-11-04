/**
 * Backup files (PLAN-2.0): the only way progress moves between browsers. Import merges:
 * events are added by id (never changed), settings by last write wins.
 */
import type { FSRS } from "ts-fsrs";
import {
  type GeoDexDb,
  type HookVoteEvent,
  type ReviewEvent,
  SETTINGS_ROW_ID,
  type SettingsRow,
} from "./db";
import { rebuildCardStates } from "./reviews";

export const BACKUP_FORMAT = "geodex-backup";
export const BACKUP_VERSION = 1;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  settings: Omit<SettingsRow, "id"> | null;
  reviewEvents: ReviewEvent[];
  hookVoteEvents: HookVoteEvent[];
};

export async function exportData(db: GeoDexDb, now = Date.now()): Promise<Backup> {
  const settings = await db.settings.get(SETTINGS_ROW_ID);
  // Rows written before 2.0 may still carry the old sync flag; backups leave it out.
  const strip = <T extends object>(row: T): T => {
    const { synced: _s, ...rest } = row as T & { synced?: unknown };
    return rest as T;
  };
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    settings: settings ? (({ id: _id, ...rest }) => rest)(settings) : null,
    reviewEvents: (await db.reviewEvents.orderBy("reviewedAt").toArray()).map(strip),
    hookVoteEvents: (await db.hookVoteEvents.toArray()).map(strip),
  };
}

/** Throws when the value is not a GeoDex backup this version can read. */
export function parseBackup(text: string): Backup {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("not json");
  }
  const b = value as Partial<Backup>;
  if (
    b?.format !== BACKUP_FORMAT ||
    b.version !== BACKUP_VERSION ||
    !Array.isArray(b.reviewEvents) ||
    !Array.isArray(b.hookVoteEvents)
  ) {
    throw new Error("not a backup");
  }
  for (const e of b.reviewEvents) {
    if (
      typeof e?.id !== "string" ||
      typeof e.cardId !== "string" ||
      typeof e.reviewedAt !== "number"
    )
      throw new Error("bad review event");
  }
  return b as Backup;
}

export async function importData(
  db: GeoDexDb,
  backup: Backup,
  scheduler: FSRS,
): Promise<{ reviews: number; votes: number }> {
  const result = await db.transaction(
    "rw",
    [db.reviewEvents, db.hookVoteEvents, db.settings],
    async () => {
      const haveReviews = new Set(await db.reviewEvents.toCollection().primaryKeys());
      const haveVotes = new Set(await db.hookVoteEvents.toCollection().primaryKeys());
      const reviews = backup.reviewEvents.filter((e) => !haveReviews.has(e.id));
      const votes = backup.hookVoteEvents.filter((v) => !haveVotes.has(v.id));
      await db.reviewEvents.bulkAdd(reviews);
      await db.hookVoteEvents.bulkAdd(votes);
      const local = await db.settings.get(SETTINGS_ROW_ID);
      if (backup.settings && (!local || backup.settings.updatedAt > local.updatedAt)) {
        await db.settings.put({ ...backup.settings, id: SETTINGS_ROW_ID });
      }
      return { reviews: reviews.length, votes: votes.length };
    },
  );
  if (result.reviews > 0) await rebuildCardStates(db, scheduler);
  return result;
}
