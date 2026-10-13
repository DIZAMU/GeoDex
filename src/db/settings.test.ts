import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type GeoDexDb } from "./db";
import { ensureDeviceSettings, ensureSettings, setLocale, setThemePreference } from "./settings";

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
    expect(first.theme).toBe("atlas");
    expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.deviceId).toBe(first.deviceId);
  });

  it("stores the theme preference", async () => {
    await setThemePreference(db, "playful");
    expect((await ensureDeviceSettings(db)).theme).toBe("playful");
  });
});

describe("synced settings", () => {
  it("creates settings with the default locale", async () => {
    expect((await ensureSettings(db, "nb")).locale).toBe("nb");
    expect((await ensureSettings(db, "en")).locale).toBe("nb");
  });

  it("bumps updatedAt when the locale changes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000);
    await ensureSettings(db, "en");
    vi.setSystemTime(2_000);
    await setLocale(db, "nb");
    const row = await ensureSettings(db, "en");
    expect(row).toMatchObject({ locale: "nb", updatedAt: 2_000 });
  });
});
