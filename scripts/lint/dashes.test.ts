import { describe, expect, it } from "vitest";
import { EM_DASH, EN_DASH, findDashes, shouldCheck } from "./dashes.ts";

describe("findDashes", () => {
  it("flags en and em dashes with line numbers", () => {
    const hits = findDashes(
      "a.md",
      `ok\nOslo ${EM_DASH} Bergen\n1990${EN_DASH}2000\nplain - hyphen`,
    );
    expect(hits.map((h) => h.line)).toEqual([2, 3]);
  });

  it("ignores hyphens and minus signs", () => {
    expect(findDashes("a.ts", "const x = a - b; // e-mail − 3")).toEqual([]);
  });
});

describe("shouldCheck", () => {
  it("checks source, content and dotfiles", () => {
    expect(shouldCheck("src/i18n/nb.json")).toBe(true);
    expect(shouldCheck("content/VOICE.md")).toBe(true);
    expect(shouldCheck(".gitignore")).toBe(true);
  });

  it("skips verbatim third-party texts, binaries and the lockfile", () => {
    expect(shouldCheck("LICENSE")).toBe(false);
    expect(shouldCheck("public/licenses/newsreader-OFL.txt")).toBe(false);
    expect(shouldCheck("public/flags/no.png")).toBe(false);
    expect(shouldCheck("pnpm-lock.yaml")).toBe(false);
  });
});
