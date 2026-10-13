// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CountriesFile, Country } from "@/data/types";
import { COUNTRY_CARD_TYPES } from "../types";
import {
  hookStats,
  hookWeight,
  MAX_WORDS,
  momentFor,
  type SelectInput,
  selectExplanation,
} from "./select";
import { buildSlots } from "./slots";
import { eligible } from "./template";
import { type EntityContent, MOMENTS, type TemplatesFile } from "./types";

// Compiled by `pnpm test` before vitest runs.
const templates = JSON.parse(readFileSync("src/generated/templates.json", "utf8")) as TemplatesFile;
const data = JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile;
const byId = new Map(data.countries.map((c) => [c.id, c]));
const get = (id: string) => byId.get(id) as Country;

const content: EntityContent = {
  entityId: "AUT",
  hooks: {
    en: [
      { id: "t.en.1", type: "anchor", text: "Austria sits south of Germany." },
      { id: "t.en.2", type: "shape", text: "Austria is a drumstick pointing west." },
      { id: "t.en.3", type: "sound", text: "Austria: an ostrich in the Alps." },
      { id: "t.en.4", type: "story", text: "Vienna grew on the Danube trade." },
      { id: "t.en.5", type: "flag_decode", text: "Red, white, red: a belted tunic." },
    ],
    nb: [
      { id: "t.nb.1", type: "anchor", text: "Østerrike ligger sør for Tyskland." },
      { id: "t.nb.2", type: "shape", text: "Østerrike er en trommestikke mot vest." },
      { id: "t.nb.3", type: "sound", text: "Østerrike: rike i øst." },
    ],
  },
  facts: [
    { id: "t.f1", tier: 1, verified: true, text: { en: "Fact one.", nb: "Fakta en." } },
    { id: "t.f2", tier: 1, verified: true, text: { en: "Fact two.", nb: "Fakta to." } },
    { id: "t.f3", tier: 2, verified: true, text: { en: "Fact three.", nb: "Fakta tre." } },
    { id: "t.f4", tier: 2, verified: true, text: { en: "Fact four.", nb: "Fakta fire." } },
    { id: "t.f5", tier: 3, verified: true, text: { en: "Fact five.", nb: "Fakta fem." } },
  ],
};

function input(overrides: Partial<SelectInput> = {}): SelectInput {
  const locale = overrides.locale ?? "en";
  return {
    locale,
    moment: "correct",
    cardId: "AUT:map_to_name",
    cardType: "map_to_name",
    reps: 0,
    content,
    templates,
    slots: buildSlots({
      locale,
      target: get("AUT"),
      home: get("NOR"),
      countryById: (id) => byId.get(id),
      subregionName: (id) => id,
      stability: () => 0,
      timesSeen: 0,
      lastHookType: null,
    }),
    recent: [],
    seenFacts: new Set(),
    hidden: new Set(),
    stats: new Map(),
    ...overrides,
  };
}

describe("templates", () => {
  it("have the same ids in both locales", () => {
    expect(templates.nb.map((t) => t.id)).toEqual(templates.en.map((t) => t.id));
  });

  it("offer at least one eligible template per moment, card type and locale with bare slots", () => {
    for (const locale of ["en", "nb"] as const) {
      // No home, no wrong pick, no neighbors: the hardest case (an island, nothing known).
      const slots = buildSlots({
        locale,
        target: get("ISL"),
        countryById: (id) => byId.get(id),
        subregionName: (id) => id,
        stability: () => 0,
        timesSeen: 0,
        lastHookType: null,
      });
      for (const moment of MOMENTS) {
        for (const type of COUNTRY_CARD_TYPES) {
          const pool = templates[locale].filter(
            (t) => t.moment === moment && t.cardTypes.includes(type) && eligible(t, slots),
          );
          expect(pool.length, `${locale} ${moment} ${type}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("selection", () => {
  it("is deterministic for the same card and review count", () => {
    expect(selectExplanation(input({ reps: 4 }))).toEqual(selectExplanation(input({ reps: 4 })));
  });

  it("never repeats a snippet shown in the last 3 views when there are alternatives", () => {
    const recent: string[][] = [];
    for (let reps = 0; reps < 12; reps++) {
      const e = selectExplanation(input({ moment: "wrong", reps, recent }));
      const window = new Set(recent.slice(0, 3).flat());
      for (const id of e.snippetIds.filter((s) => s.startsWith("h:"))) {
        expect(window.has(id), `${reps}: ${id}`).toBe(false);
      }
      recent.unshift(e.snippetIds);
    }
  });

  it("varies: 10 reviews of one card show at least 4 distinct snippet combinations", () => {
    const recent: string[][] = [];
    const combos = new Set<string>();
    for (let reps = 0; reps < 10; reps++) {
      const moment = (["correct", "wrong", "correct_hard", "correct", "lapse"] as const)[reps % 5];
      const e = selectExplanation(input({ moment, reps, recent }));
      combos.add(e.snippetIds.join("+"));
      recent.unshift(e.snippetIds);
    }
    expect(combos.size).toBeGreaterThanOrEqual(4);
  });

  it("introduces with an anchor hook and a tier 1 fact", () => {
    const e = selectExplanation(input({ moment: "introduce" }));
    expect(e.blocks.find((b) => b.kind === "hook")).toMatchObject({ hookType: "anchor" });
    expect(e.blocks.find((b) => b.kind === "fact")).toMatchObject({ tier: 1 });
  });

  it("shows the lowest unseen tier on a correct answer", () => {
    const seen = new Set(["f:t.f1", "f:t.f2"]);
    const e = selectExplanation(input({ moment: "correct", seenFacts: seen }));
    expect(e.blocks.find((b) => b.kind === "fact")).toMatchObject({ tier: 2 });
  });

  it("switches hook type on a lapse and keeps flag hooks off map cards", () => {
    for (let reps = 0; reps < 10; reps++) {
      const slots = { ...input().slots, "user.lastHookType": "anchor" };
      const e = selectExplanation(input({ moment: "lapse", reps, slots }));
      const hook = e.blocks.find((b) => b.kind === "hook");
      expect(hook && "hookType" in hook ? hook.hookType : null).not.toBe("anchor");
      expect(hook && "hookType" in hook ? hook.hookType : null).not.toBe("flag_decode");
    }
  });

  it("never shows a hook voted not helpful", () => {
    const hidden = new Set(["t.en.1", "t.en.2", "t.en.3"]);
    for (let reps = 0; reps < 10; reps++) {
      const e = selectExplanation(input({ moment: "wrong", reps, hidden }));
      expect(e.snippetIds.filter((s) => s.startsWith("h:"))).toEqual(["h:t.en.4"]);
    }
  });

  it("caps moment content at 60 words except for leeches", () => {
    const long = "word ".repeat(40).trim();
    const big: EntityContent = {
      ...content,
      hooks: { ...content.hooks, en: content.hooks.en.map((h) => ({ ...h, text: long })) },
    };
    const e = selectExplanation(input({ moment: "wrong", content: big }));
    const words = e.blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0);
    expect(words).toBeLessThanOrEqual(MAX_WORDS);
    const leech = selectExplanation(input({ moment: "leech", content: big }));
    expect(leech.blocks.filter((b) => b.kind === "hook")).toHaveLength(4);
  });

  it("falls back to English hooks when Norwegian has none", () => {
    const noNb = { ...content, hooks: { ...content.hooks, nb: [] } };
    const e = selectExplanation(input({ locale: "nb", moment: "wrong", content: noNb }));
    expect(e.blocks.find((b) => b.kind === "hook")).toMatchObject({ locale: "en" });
    expect(e.blocks.find((b) => b.kind === "template")?.text).toMatch(/Østerrike/);
  });
});

describe("moments", () => {
  it("maps answers to PLAN.md 7.2 moments", () => {
    const base = {
      rating: 3 as const,
      phaseBefore: "learning" as const,
      lapsesAfter: 0,
      stabilityAfter: 3,
    };
    expect(momentFor({ ...base, correct: true })).toBe("correct");
    expect(momentFor({ ...base, correct: true, rating: 2 })).toBe("correct_hard");
    expect(momentFor({ ...base, correct: true, stabilityAfter: 70 })).toBe("mastered");
    expect(momentFor({ ...base, correct: false, rating: 1 })).toBe("wrong");
    expect(momentFor({ ...base, correct: false, rating: 1, phaseBefore: "review" })).toBe("lapse");
    expect(momentFor({ ...base, correct: false, rating: 1, lapsesAfter: 6 })).toBe("leech");
  });
});

describe("hook effectiveness", () => {
  it("scores the next review after a hook and counts not-helpful votes as failures", () => {
    const e = (id: string, at: number, correct: boolean, snippetIds: string[] = []) => ({
      cardId: id,
      reviewedAt: at,
      correct,
      scheduled: true,
      snippetIds,
    });
    const types: Record<string, "anchor" | "sound"> = { a: "anchor", s: "sound" };
    const stats = hookStats(
      [
        e("X:map_to_name", 1, false, ["h:a"]),
        e("X:map_to_name", 2, true, ["h:s"]),
        e("X:map_to_name", 3, false),
        e("Y:map_to_name", 1, false, ["h:a"]),
        e("Y:map_to_name", 2, true),
      ],
      [{ hookId: "s" }],
      (id) => types[id],
    );
    expect(stats.get("anchor")).toEqual({ successes: 2, failures: 0 });
    expect(stats.get("sound")).toEqual({ successes: 0, failures: 2 });
    expect(hookWeight(stats, "anchor")).toBeCloseTo(0.75);
    expect(hookWeight(stats, "sound")).toBeCloseTo(0.25);
    expect(hookWeight(stats, "story")).toBe(0.5);
  });
});
