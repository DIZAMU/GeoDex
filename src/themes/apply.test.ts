import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, readThemeMirror, THEME_MIRROR_KEY, watchSystemTheme } from "./apply";

let dark = false;
const listeners = new Set<() => void>();

beforeEach(() => {
  dark = false;
  listeners.clear();
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return dark;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("applyTheme", () => {
  it("sets the resolved theme and mirrors the preference", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_MIRROR_KEY)).toBe("dark");
    expect(readThemeMirror()).toBe("dark");
  });

  it("follows the system when the preference is auto", () => {
    dark = true;
    applyTheme("auto");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePreference).toBe("auto");

    const stop = watchSystemTheme(() => applyTheme("auto"));
    dark = false;
    for (const listener of listeners) listener();
    expect(document.documentElement.dataset.theme).toBe("light");
    stop();
    expect(listeners.size).toBe(0);
  });

  it("falls back to light for an unknown value and maps 1.0 themes", () => {
    localStorage.setItem(THEME_MIRROR_KEY, "neon");
    expect(readThemeMirror()).toBe("light");
    localStorage.setItem(THEME_MIRROR_KEY, "atlas");
    expect(readThemeMirror()).toBe("dark");
  });
});
