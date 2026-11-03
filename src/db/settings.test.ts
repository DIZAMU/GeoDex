import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, DEFAULT_SETTINGS, type GeoDexDb } from "./db";
import {
  ensureDeviceSettings,
  ensureSettings,
  setLastInputMode,
  setLocale,
  setThemePreference,
  updateSettings,
} from "./settings";

let db: GeoDexDb;
let counter = 0;

beforeEach(() => {
  counter += 1;
  db = createDb(`test-${counter}`);
});

afterEach(async () => {
  await db.delete();
  vi.useRealTimers();
});

describe("device settings", () => {
  it("creates defaults once and keeps the device id stable", async () => {
    const first = await ensureDeviceSettings(db);
    const second = await ensureDeviceSettings(db);
    expect(first.theme).toBe("light");
    expect(first.lastInputMode).toBe("auto");
    expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.deviceId).toBe(first.deviceId);
  });

  it("stores the theme preference and last input mode", async () => {
    await setThemePreference(db, "dark");
    await setLastInputMode(db, "typing");
    expect(await ensureDeviceSettings(db)).toMatchObject({
      theme: "dark",
      lastInputMode: "typing",
    });
  });
});

describe("synced settings", () => {
  it("creates settings with the default locale and defaults", async () => {
    const row = await ensureSettings(db, "nb");
    expect(row).toMatchObject({ locale: "nb", ...DEFAULT_SETTINGS });
    expect((await ensureSettings(db, "en")).locale).toBe("nb");
  });

  it("bumps updatedAt on every change", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000);
    await ensureSettings(db, "en");
    vi.setSystemTime(2_000);
    await setLocale(db, "nb");
    vi.setSystemTime(3_000);
    await updateSettings(db, { homeCountry: "NOR", dailyMinutes: 15 });
    expect(await ensureSettings(db, "en")).toMatchObject({
      locale: "nb",
      homeCountry: "NOR",
      dailyMinutes: 15,
      updatedAt: 3_000,
    });
  });
});

describe("schema upgrade", () => {
  it("fills new settings with defaults when upgrading from version 1", async () => {
    const { default: Dexie } = await import("dexie");
    const name = `upgrade-${counter}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ settings: "id", deviceSettings: "id" });
    await v1.table("settings").add({ id: "user", locale: "nb", updatedAt: 5 });
    await v1.table("deviceSettings").add({ id: "device", deviceId: "d", theme: "minimal" });
    v1.close();

    const upgraded = createDb(name);
    expect(await upgraded.settings.get("user")).toMatchObject({
      locale: "nb",
      dailyMinutes: 18,
      updatedAt: 5,
    });
    expect(await upgraded.deviceSettings.get("device")).toMatchObject({
      theme: "light",
      lastInputMode: "auto",
    });
    await upgraded.delete();
  });
});
