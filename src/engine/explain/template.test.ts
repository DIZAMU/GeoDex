import { describe, expect, it } from "vitest";
import {
  eligible,
  evalWhen,
  parseBody,
  parseTemplateFile,
  parseWhen,
  render,
  slotPaths,
  TemplateError,
} from "./template";

describe("template bodies", () => {
  it("parses slots and nested optional segments", () => {
    const tokens = parseBody("{a.b} is in {c}{?d:, next to {d}}.");
    expect(slotPaths(tokens)).toEqual(["a.b", "c", "d", "d"]);
    expect(render(tokens, { "a.b": "Laos", c: "Asia", d: "Thailand" })).toBe(
      "Laos is in Asia, next to Thailand.",
    );
    expect(render(tokens, { "a.b": "Laos", c: "Asia" })).toBe("Laos is in Asia.");
  });

  it("returns null when a required slot is missing, empty or false", () => {
    const tokens = parseBody("{a} and {b}");
    expect(render(tokens, { a: "x" })).toBeNull();
    expect(render(tokens, { a: "x", b: "" })).toBeNull();
    expect(render(tokens, { a: "x", b: false })).toBeNull();
    expect(render(tokens, { a: "x", b: 0 })).toBe("x and 0");
  });

  it("rejects malformed bodies", () => {
    for (const bad of ["{a", "a}", "{?a no colon}", "{?a:unclosed", "{bad path}", "{1a}"]) {
      expect(() => parseBody(bad), bad).toThrow(TemplateError);
    }
  });
});

describe("when", () => {
  it("parses clauses joined by and", () => {
    expect(parseWhen("a.b > 1500 and c == true and d != 'x y' and e <= -2.5")).toEqual([
      { path: "a.b", op: ">", value: 1500 },
      { path: "c", op: "==", value: true },
      { path: "d", op: "!=", value: "x y" },
      { path: "e", op: "<=", value: -2.5 },
    ]);
    expect(parseWhen("")).toEqual([]);
  });

  it("evaluates without eval, false when the slot is missing", () => {
    const clauses = parseWhen("km > 1500 and island == false");
    expect(evalWhen(clauses, { km: 2000, island: false })).toBe(true);
    expect(evalWhen(clauses, { km: 1000, island: false })).toBe(false);
    expect(evalWhen(clauses, { island: false })).toBe(false);
    expect(evalWhen(parseWhen("x >= 3"), { x: "4" })).toBe(false);
  });

  it("rejects anything outside the grammar", () => {
    for (const bad of ["a", "a >", "> 3", "a = 3", "a > (3)", "process.exit() == 1 or 1"]) {
      expect(() => parseWhen(bad), bad).toThrow(TemplateError);
    }
  });
});

describe("template files", () => {
  const file = `---
id: wrong.location.basic
moment: wrong
cardTypes: [map_to_name, name_to_map]
requires: [chosen]
---
You picked {chosen.name}.
---
id: correct.any
moment: correct
when: target.km > 10
---
{target.name}.
`;

  it("parses frontmatter and bodies, defaulting card types to every country card", () => {
    const [a, b] = parseTemplateFile(file);
    expect(a).toMatchObject({ id: "wrong.location.basic", requires: ["chosen"] });
    expect(a?.cardTypes).toEqual(["map_to_name", "name_to_map"]);
    expect(b?.cardTypes).toHaveLength(8);
    expect(b?.when).toEqual([{ path: "target.km", op: ">", value: 10 }]);
  });

  it("checks requires, when and required slots together", () => {
    const [a, b] = parseTemplateFile(file);
    if (!a || !b) throw new Error("templates");
    expect(eligible(a, { "chosen.name": "Peru" })).toBe(false);
    expect(eligible(a, { chosen: true, "chosen.name": "Peru" })).toBe(true);
    expect(eligible(b, { "target.name": "Peru", "target.km": 5 })).toBe(false);
  });

  it("rejects unknown moments and card types, and text before the first block", () => {
    expect(() => parseTemplateFile("x\n---\nid: a\nmoment: correct\n---\nb")).toThrow();
    expect(() => parseTemplateFile("---\nid: a\nmoment: nope\n---\nb")).toThrow(/moment/);
    expect(() => parseTemplateFile("---\nid: a\nmoment: correct\ncardTypes: [x]\n---\nb")).toThrow(
      /card type/,
    );
  });
});
