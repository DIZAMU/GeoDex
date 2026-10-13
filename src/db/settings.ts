import type { InputSetting } from "@/engine/types";
import type { Locale } from "@/i18n/locales";
import { DEFAULT_THEME_PREFERENCE, type ThemePreference } from "@/themes/themes";
import {
  DEFAULT_SETTINGS,
  DEVICE_ROW_ID,
  type DeviceSettingsRow,
  type GeoDexDb,
  SETTINGS_ROW_ID,
  type SettingsRow,
  type SettingsValues,
} from "./db";

/** Returns this device's settings, creating them with a new device id on first run. */
export function ensureDeviceSettings(db: GeoDexDb): Promise<DeviceSettingsRow> {
  return db.transaction("rw", db.deviceSettings, async () => {
    const existing = await db.deviceSettings.get(DEVICE_ROW_ID);
    if (existing) return existing;
    const row: DeviceSettingsRow = {
      id: DEVICE_ROW_ID,
      deviceId: crypto.randomUUID(),
      theme: DEFAULT_THEME_PREFERENCE,
      lastInputMode: "auto",
      persistRequested: false,
    };
    await db.deviceSettings.add(row);
    return row;
  });
}

export async function setThemePreference(db: GeoDexDb, theme: ThemePreference): Promise<void> {
  await ensureDeviceSettings(db);
  await db.deviceSettings.update(DEVICE_ROW_ID, { theme });
}

export async function setLastInputMode(db: GeoDexDb, lastInputMode: InputSetting): Promise<void> {
  await ensureDeviceSettings(db);
  await db.deviceSettings.update(DEVICE_ROW_ID, { lastInputMode });
}

/** Asks the browser to keep IndexedDB through storage pressure, once per device. */
export async function requestPersistentStorage(db: GeoDexDb): Promise<void> {
  const device = await ensureDeviceSettings(db);
  if (device.persistRequested) return;
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported or refused: the app still works; sync and export protect the data.
  }
  await db.deviceSettings.update(DEVICE_ROW_ID, { persistRequested: true });
}

/** Returns the synced settings, creating them with defaults on first run. */
export function ensureSettings(db: GeoDexDb, defaultLocale: Locale): Promise<SettingsRow> {
  return db.transaction("rw", db.settings, async () => {
    const existing = await db.settings.get(SETTINGS_ROW_ID);
    if (existing) return existing;
    const row: SettingsRow = {
      id: SETTINGS_ROW_ID,
      locale: defaultLocale,
      ...DEFAULT_SETTINGS,
      updatedAt: Date.now(),
    };
    await db.settings.add(row);
    return row;
  });
}

export async function setLocale(db: GeoDexDb, locale: Locale): Promise<void> {
  await ensureSettings(db, locale);
  await db.settings.update(SETTINGS_ROW_ID, { locale, updatedAt: Date.now() });
}

/** Changes synced settings and bumps updatedAt for last-write-wins sync. */
export async function updateSettings(db: GeoDexDb, patch: Partial<SettingsValues>): Promise<void> {
  await db.settings.update(SETTINGS_ROW_ID, { ...patch, updatedAt: Date.now() });
}
