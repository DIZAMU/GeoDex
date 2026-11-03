import Dexie, { type EntityTable } from "dexie";
import { type CardState, createScheduler, replayAll } from "@/engine/scheduler";
import type { AnswerMode, CardId, InputSetting, Rating } from "@/engine/types";
import type { Locale } from "@/i18n/locales";
import type { ThemePreference } from "@/themes/themes";

export const SETTINGS_ROW_ID = "user";
export const DEVICE_ROW_ID = "device";

export type ModuleId = "countries" | "cities" | "groups" | "landmarks" | "physical" | "history";

/** Synced settings. One row per user; last write wins by updatedAt (PLAN.md 5.5). */
export type SettingsRow = {
  id: typeof SETTINGS_ROW_ID;
  locale: Locale;
  homeCountry: string | null; // ISO3; null until onboarding
  dailyMinutes: number;
  newPerDayOverride: number | null;
  requestRetention: number;
  fsrsParams: number[] | null;
  dayStartHour: number;
  scope: { partiallyRecognized: boolean; territories: boolean };
  modules: Record<ModuleId, boolean>;
  moduleWeights: Record<ModuleId, number>;
  /** Stage 4 country cards (currency and language). */
  currencyAndLanguage: boolean;
  countdownSeconds: 0 | 10 | 15 | 20;
  placementCompletedAt: number | null;
  /**
   * "Reset progress": events at or before this time are kept but no longer replayed.
   * Absent on rows written before the reset existed.
   */
  progressResetAt?: number | null;
  /** The daily goal kind (PLAN.md 11.4). Absent means minutes, using `dailyMinutes`. */
  dailyGoal?: { kind: "minutes" } | { kind: "sessions"; sessions: number };
  updatedAt: number;
};

export type SettingsValues = Omit<SettingsRow, "id" | "locale" | "updatedAt">;

export const DEFAULT_SETTINGS: SettingsValues = {
  homeCountry: null,
  dailyMinutes: 18,
  newPerDayOverride: null,
  requestRetention: 0.9,
  fsrsParams: null,
  dayStartHour: 4,
  scope: { partiallyRecognized: false, territories: false },
  modules: {
    countries: true,
    cities: false,
    groups: false,
    landmarks: false,
    physical: false,
    history: false,
  },
  moduleWeights: { countries: 3, cities: 1, groups: 1, landmarks: 1, physical: 1, history: 1 },
  currencyAndLanguage: true,
  countdownSeconds: 0,
  placementCompletedAt: null,
  progressResetAt: null,
};

/** Settings that belong to this browser only, never written to a backup. */
export type DeviceSettingsRow = {
  id: typeof DEVICE_ROW_ID;
  deviceId: string;
  theme: ThemePreference;
  lastInputMode: InputSetting;
  persistRequested: boolean;
  /** When the guided tour was finished or skipped; null shows it once on Today. */
  tourDoneAt?: number | null;
  /** The Today info box: open or closed by the learner; null follows the first-week default. */
  infoboxOpen?: boolean | null;
  /** The session picker's last length and focus (PLAN.md 11.2); null uses the defaults. */
  sessionLength?: number | null;
  sessionFocus?: string | null;
  /** The way to the next memory level on Today: cards to go (default) or a percentage. */
  levelProgress?: "cards" | "percent" | null;
  /** When a backup file was last downloaded from this browser; null or absent means never. */
  lastBackupAt?: number | null;
};

/** One answer. Append-only: never updated or deleted. */
export type ReviewEvent = {
  id: string;
  cardId: CardId;
  reviewedAt: number;
  rating: Rating;
  mode: AnswerMode;
  inputSetting: InputSetting;
  correct: boolean;
  chosenAnswer: string | null;
  /** Prompt shown to answer submitted. Never includes time reading feedback. */
  responseMs: number;
  /** Prompt shown to continue pressed, for the time budget. */
  durationMs: number;
  snippetIds: string[];
  scheduled: boolean;
  locale: Locale;
  deviceId: string;
};

/** A "Not helpful" tap on a hook. Append-only. */
export type HookVoteEvent = {
  id: string;
  cardId: CardId;
  hookId: string;
  createdAt: number;
  deviceId: string;
};

/** Saved progress of an unfinished placement test, on this device only. */
export type PlacementProgressRow = { id: "current"; state: unknown; updatedAt: number };

export type GeoDexDb = Dexie & {
  settings: EntityTable<SettingsRow, "id">;
  deviceSettings: EntityTable<DeviceSettingsRow, "id">;
  reviewEvents: EntityTable<ReviewEvent, "id">;
  hookVoteEvents: EntityTable<HookVoteEvent, "id">;
  /** Cache only: rebuildable from reviewEvents and settings at any time. */
  cardState: EntityTable<CardState, "cardId">;
  placementProgress: EntityTable<PlacementProgressRow, "id">;
};

export function createDb(name = "geodex"): GeoDexDb {
  const db = new Dexie(name) as GeoDexDb;
  db.version(1).stores({
    settings: "id",
    deviceSettings: "id",
  });
  db.version(2)
    .stores({
      settings: "id",
      deviceSettings: "id",
      reviewEvents: "id, cardId, reviewedAt, synced",
      hookVoteEvents: "id, cardId, synced",
      cardState: "cardId, due",
      syncMeta: "table",
      placementProgress: "id",
    })
    .upgrade(async (tx) => {
      await tx
        .table("settings")
        .toCollection()
        .modify((row: Partial<SettingsRow>) => {
          Object.assign(row, { ...DEFAULT_SETTINGS, ...row });
        });
      await tx
        .table("deviceSettings")
        .toCollection()
        .modify((row: Partial<DeviceSettingsRow>) => {
          row.lastInputMode ??= "auto";
          row.persistRequested ??= false;
        });
    });
  // v3: correct placement answers now seed a review interval of days (DECISIONS.md 027).
  // The card state cache is rebuilt from events so existing placements pick that up.
  db.version(3)
    .stores({})
    .upgrade(async (tx) => {
      const settings = (await tx.table("settings").get(SETTINGS_ROW_ID)) as
        | Partial<SettingsRow>
        | undefined;
      const scheduler = createScheduler({
        requestRetention: settings?.requestRetention ?? DEFAULT_SETTINGS.requestRetention,
        ...(settings?.fsrsParams ? { w: settings.fsrsParams } : {}),
      });
      const states = replayAll(
        scheduler,
        (await tx.table("reviewEvents").toArray()) as ReviewEvent[],
      );
      await tx.table("cardState").clear();
      await tx.table("cardState").bulkPut([...states.values()]);
    });
  // v4 (2.0): no accounts and no sync, so the sync index and bookkeeping table go.
  // Stored answers are untouched; old rows may still carry an unused `synced` field.
  db.version(4).stores({
    reviewEvents: "id, cardId, reviewedAt",
    hookVoteEvents: "id, cardId",
    syncMeta: null,
  });
  return db;
}

export const db = createDb();
