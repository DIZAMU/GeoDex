import type { Locale } from "@/i18n/locales";
import { DEFAULT_THEME_PREFERENCE, type ThemePreference } from "@/themes/themes";
import {
  DEVICE_ROW_ID,
  type DeviceSettingsRow,
  type GeoDexDb,
  SETTINGS_ROW_ID,
  type SettingsRow,
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
    };
    await db.deviceSettings.add(row);
    return row;
  });
}

export async function setThemePreference(db: GeoDexDb, theme: ThemePreference): Promise<void> {
  await ensureDeviceSettings(db);
  await db.deviceSettings.update(DEVICE_ROW_ID, { theme });
}

/** Returns the synced settings, creating them with the given locale on first run. */
export function ensureSettings(db: GeoDexDb, defaultLocale: Locale): Promise<SettingsRow> {
  return db.transaction("rw", db.settings, async () => {
    const existing = await db.settings.get(SETTINGS_ROW_ID);
    if (existing) return existing;
    const row: SettingsRow = { id: SETTINGS_ROW_ID, locale: defaultLocale, updatedAt: Date.now() };
    await db.settings.add(row);
    return row;
  });
}

export async function setLocale(db: GeoDexDb, locale: Locale): Promise<void> {
  await ensureSettings(db, locale);
  await db.settings.update(SETTINGS_ROW_ID, { locale, updatedAt: Date.now() });
}
