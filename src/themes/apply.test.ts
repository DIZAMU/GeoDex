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
    applyTheme("playful");
    expect(document.documentElement.dataset.theme).toBe("playful");
    expect(localStorage.getItem(THEME_MIRROR_KEY)).toBe("playful");
    expect(readThemeMirror()).toBe("playful");
  });

  it("follows the system when the preference is auto", () => {
    dark = true;
    applyTheme("auto");
    expect(document.documentElement.dataset.theme).toBe("atlas");
    expect(document.documentElement.dataset.themePreference).toBe("auto");

    const stop = watchSystemTheme(() => applyTheme("auto"));
    dark = false;
    for (const listener of listeners) listener();
    expect(document.documentElement.dataset.theme).toBe("minimal");
    stop();
    expect(listeners.size).toBe(0);
  });

  it("falls back to Atlas when the mirror holds an unknown value", () => {
    localStorage.setItem(THEME_MIRROR_KEY, "neon");
    expect(readThemeMirror()).toBe("atlas");
  });
});
