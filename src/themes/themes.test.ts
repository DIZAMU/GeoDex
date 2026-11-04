import { describe, expect, it } from "vitest";
import { isThemePreference, normalizeThemePreference, resolveTheme } from "./themes";

describe("resolveTheme", () => {
  it("maps auto to the device's mode", () => {
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
  });

  it("keeps an explicit choice regardless of the device", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("theme preferences", () => {
  it("rejects unknown values", () => {
    expect(isThemePreference("auto")).toBe(true);
    expect(isThemePreference("atlas")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it("moves the three 1.0 themes onto the two modes", () => {
    expect(normalizeThemePreference("atlas")).toBe("dark");
    expect(normalizeThemePreference("minimal")).toBe("light");
    expect(normalizeThemePreference("playful")).toBe("light");
    expect(normalizeThemePreference("auto")).toBe("auto");
    expect(normalizeThemePreference(undefined)).toBe("light");
  });
});
