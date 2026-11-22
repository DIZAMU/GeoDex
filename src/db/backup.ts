/**
 * Backup files: the only way progress moves between browsers. Import merges:
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

/**
 * The largest backup file restore reads. Years of daily study come to a few megabytes, so a
 * file far beyond this is not a GeoDex backup, and reading it whole would freeze the page.
 */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

const isString = (v: unknown, max = 200): v is string => typeof v === "string" && v.length <= max;
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isOptionalNumber = (v: unknown) => v === undefined || v === null || isNumber(v);

/** Checks each field the app reads from a restored settings row. */
function validSettings(s: unknown): boolean {
  if (s === null) return true;
  if (typeof s !== "object") return false;
  const v = s as Record<string, unknown>;
  const modules = v.modules as Record<string, unknown> | undefined;
  return (
    (v.locale === "en" || v.locale === "nb") &&
    (v.homeCountry === null || isString(v.homeCountry, 8)) &&
    isNumber(v.dailyMinutes) &&
    v.dailyMinutes > 0 &&
    v.dailyMinutes <= 600 &&
    (v.newPerDayOverride === null || (isNumber(v.newPerDayOverride) && v.newPerDayOverride >= 0)) &&
    (v.reviewsPerDay === undefined ||
      v.reviewsPerDay === null ||
      (Number.isInteger(v.reviewsPerDay) &&
        (v.reviewsPerDay as number) > 0 &&
        (v.reviewsPerDay as number) <= 1000)) &&
    isNumber(v.requestRetention) &&
    v.requestRetention > 0.5 &&
    v.requestRetention < 1 &&
    Number.isInteger(v.dayStartHour) &&
    (v.dayStartHour as number) >= 0 &&
    (v.dayStartHour as number) <= 23 &&
    typeof modules === "object" &&
    modules !== null &&
    Object.values(modules).every((m) => typeof m === "boolean") &&
    isOptionalNumber(v.progressResetAt) &&
    isNumber(v.updatedAt)
  );
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
      !isString(e?.id) ||
      !isString(e.cardId) ||
      !isNumber(e.reviewedAt) ||
      ![1, 2, 3, 4].includes(e.rating as number) ||
      !isString(e.mode, 20) ||
      !isOptionalNumber(e.responseMs)
    )
      throw new Error("bad review event");
  }
  for (const v of b.hookVoteEvents) {
    if (!isString(v?.id) || !isString(v.cardId) || !isString(v.hookId))
      throw new Error("bad hook vote");
  }
  if (!validSettings(b.settings ?? null)) throw new Error("bad settings");
  return b as Backup;
}

/** Reads a backup file the learner picked, refusing one too large to be a backup. */
export async function readBackupFile(file: Blob): Promise<Backup> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error("too large");
  return parseBackup(await file.text());
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
