// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileTemplates } from "./compile-templates.ts";
import { lintContent, readRules, textProblems } from "./lint.ts";

function templateDir(en: string, nb: string): string {
  const root = mkdtempSync(join(tmpdir(), "templates-"));
  for (const [locale, body] of [
    ["en", en],
    ["nb", nb],
  ] as const) {
    mkdirSync(join(root, locale));
    writeFileSync(join(root, locale, "correct.md"), body);
  }
  return root;
}

const ok = "---\nid: correct.a\nmoment: correct\n---\n{target.name}.\n";

describe("template compiler", () => {
  it("compiles the committed templates in both locales", () => {
    const compiled = compileTemplates();
    expect(compiled.en.length).toBeGreaterThan(0);
    expect(compiled.nb.map((t) => t.id)).toEqual(compiled.en.map((t) => t.id));
  });

  it("fails on unknown slots, missing ids per locale, and moments in the wrong file", () => {
    expect(() =>
      compileTemplates(
        templateDir("---\nid: correct.a\nmoment: correct\n---\n{target.nope}.\n", ok),
      ),
    ).toThrow(/unknown slot target.nope/);
    expect(() =>
      compileTemplates(
        templateDir(ok, "---\nid: correct.b\nmoment: correct\n---\n{target.name}.\n"),
      ),
    ).toThrow(/correct.a exists in en but not nb/);
    expect(() =>
      compileTemplates(templateDir("---\nid: correct.a\nmoment: wrong\n---\n{target.name}.\n", ok)),
    ).toThrow(/has moment wrong/);
  });
});

describe("content linter", () => {
  const rules = readRules();

  it("reads the rules from VOICE.md", () => {
    expect(rules.locales).toEqual(["en", "nb"]);
    expect(rules.max_length.hook).toBe(140);
  });

  it("flags banned words, phrases, characters and length in each language", () => {
    expect(textProblems("Did you know Laos is landlocked.", "en", "hook", rules)).toContain(
      'banned phrase "did you know"',
    );
    expect(textProblems("A charming capital.", "en", "hook", rules)).toContain(
      'banned word "charming"',
    );
    expect(textProblems("En sjarmerende by.", "nb", "hook", rules)).toContain(
      'banned word "sjarmerende"',
    );
    expect(textProblems("Big!", "en", "hook", rules).some((p) => p.includes("U+21"))).toBe(true);
    expect(textProblems("x".repeat(141), "en", "hook", rules)[0]).toMatch(/141 characters/);
    expect(textProblems('Kalt "øya".', "nb", "fact", rules)[0]).toMatch(/« »/);
    // "rich history" is banned as a phrase, "rich" alone is not.
    expect(textProblems("Rich in oil.", "en", "fact", rules)).toEqual([]);
  });

  it("passes the committed content", () => {
    expect(lintContent()).toEqual([]);
  });
});
