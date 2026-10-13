import { describe, expect, it } from "vitest";
import { isThemePreference, resolveTheme } from "./themes";

describe("resolveTheme", () => {
  it("maps auto to Atlas on dark systems and Minimal on light systems", () => {
    expect(resolveTheme("auto", true)).toBe("atlas");
    expect(resolveTheme("auto", false)).toBe("minimal");
  });

  it("keeps an explicit choice regardless of the system", () => {
    expect(resolveTheme("playful", true)).toBe("playful");
    expect(resolveTheme("minimal", true)).toBe("minimal");
    expect(resolveTheme("atlas", false)).toBe("atlas");
  });
});

describe("isThemePreference", () => {
  it("rejects unknown values", () => {
    expect(isThemePreference("auto")).toBe(true);
    expect(isThemePreference("dark")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});
