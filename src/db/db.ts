import Dexie, { type EntityTable } from "dexie";
import type { Locale } from "@/i18n/locales";
import type { ThemePreference } from "@/themes/themes";

/** Synced settings. One row per user; last write wins by updatedAt. */
export type SettingsRow = {
  id: typeof SETTINGS_ROW_ID;
  locale: Locale;
  updatedAt: number;
};

/** Settings that stay on this device and are never synced. */
export type DeviceSettingsRow = {
  id: typeof DEVICE_ROW_ID;
  deviceId: string;
  theme: ThemePreference;
};

export const SETTINGS_ROW_ID = "user";
export const DEVICE_ROW_ID = "device";

export type GeoDexDb = Dexie & {
  settings: EntityTable<SettingsRow, "id">;
  deviceSettings: EntityTable<DeviceSettingsRow, "id">;
};

export function createDb(name = "geodex"): GeoDexDb {
  const db = new Dexie(name) as GeoDexDb;
  db.version(1).stores({
    settings: "id",
    deviceSettings: "id",
  });
  return db;
}

export const db = createDb();
