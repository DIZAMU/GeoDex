import { describe, expect, it } from "vitest";
import { detectLocale } from "./locales";

describe("detectLocale", () => {
  it("maps every Norwegian tag to nb", () => {
    expect(detectLocale(["nb-NO"])).toBe("nb");
    expect(detectLocale(["no"])).toBe("nb");
    expect(detectLocale(["nn-NO", "en"])).toBe("nb");
  });

  it("uses the first supported language and falls back to en", () => {
    expect(detectLocale(["en-GB", "nb"])).toBe("en");
    expect(detectLocale(["de-DE", "nb"])).toBe("nb");
    expect(detectLocale(["de-DE"])).toBe("en");
    expect(detectLocale([])).toBe("en");
  });
});
