import { describe, expect, it } from "vitest";
import {
  cardModule,
  cardSkill,
  DEFAULT_SESSION_LENGTH,
  focusCounts,
  focusKey,
  MIXED,
  matchesFocus,
  parseFocus,
  parseLength,
  sliceSession,
} from "./focus";
import type { QueueItem } from "./session";
import { CITY_CARD_TYPES, COUNTRY_CARD_TYPES, HISTORY_CARD_TYPES } from "./types";

const item = (entityId: string, subregion: string, type: string, isNew = false): QueueItem => ({
  cardId: `${entityId}:${type}`,
  entityId,
  subregion,
  isNew,
});

const CONTINENT: Record<string, string> = { "154": "europe", "035": "asia", "011": "africa" };
const continentOf = (s: string) => CONTINENT[s];

describe("cardSkill and cardModule", () => {
  it("puts every country card in one skill and the countries module", () => {
    for (const t of COUNTRY_CARD_TYPES) {
      expect(cardSkill(t)).not.toBeNull();
      expect(cardModule(t)).toBe("countries");
    }
    expect(cardSkill("name_to_map")).toBe("location");
    expect(cardSkill("flag_to_name")).toBe("flags");
    expect(cardSkill("capital_to_country")).toBe("capitals");
    expect(cardSkill("country_to_language")).toBe("currency_language");
  });

  it("files module cards under their module", () => {
    for (const t of CITY_CARD_TYPES) expect(cardModule(t)).toBe("cities");
    for (const t of HISTORY_CARD_TYPES) expect(cardModule(t)).toBe("history");
    expect(cardModule("photo_to_name")).toBe("landmarks");
    expect(cardModule("map_to_feature")).toBe("physical");
    expect(cardModule("group_member")).toBe("groups");
    expect(cardSkill("city_to_map")).toBe("location");
    expect(cardSkill("map_to_empire")).toBe("location");
    expect(cardSkill("photo_to_name")).toBeNull();
    expect(cardSkill("empire_to_era")).toBeNull();
  });

  it("keeps contrast cards out of every skill", () => {
    expect(cardSkill("contrast")).toBeNull();
    expect(cardModule("contrast")).toBe("countries");
    expect(matchesFocus(item("SVK|SVN", "151", "contrast"), MIXED, continentOf)).toBe(true);
  });
});

describe("focus keys", () => {
  it("round-trips every kind", () => {
    for (const f of [
      MIXED,
      { kind: "skill", id: "flags" },
      { kind: "module", id: "cities" },
      { kind: "region", id: "south_america" },
      { kind: "region", id: "154" },
    ] as const) {
      expect(parseFocus(focusKey(f))).toEqual(f);
    }
  });

  it("falls back to mixed on anything unknown", () => {
    expect(parseFocus(null)).toEqual(MIXED);
    expect(parseFocus("skill:juggling")).toEqual(MIXED);
    expect(parseFocus("module:")).toEqual(MIXED);
    expect(parseFocus("region:<script>")).toEqual(MIXED);
  });

  it("accepts only the preset lengths", () => {
    expect(parseLength("5")).toBe(5);
    expect(parseLength(20)).toBe(20);
    expect(parseLength("7")).toBe(DEFAULT_SESSION_LENGTH);
    expect(parseLength(null)).toBe(DEFAULT_SESSION_LENGTH);
  });
});

describe("sliceSession", () => {
  // Today's plan as planDay arranges it: new cards spread among reviews.
  const plan = [
    item("NOR", "154", "map_to_name"),
    item("JPN", "035", "flag_to_name", true),
    item("SWE", "154", "flag_to_name"),
    item("KEN", "011", "country_to_capital"),
    item("CHN", "035", "name_to_map", true),
    item("FIN", "154", "capital_to_country"),
    item("EGY", "011", "flag_to_name", true),
    item("DNK", "154", "flag_to_name"),
    item("Q1748", "154", "city_to_map", true),
  ];

  it("takes due reviews before new cards and keeps the length", () => {
    const s = sliceSession(plan, MIXED, 5, continentOf);
    expect(s.queue).toHaveLength(5);
    expect(s.queue.filter((q) => q.isNew)).toHaveLength(0);
    expect(s.available).toBe(plan.length);
    expect(s.dueOutside).toBe(0);
  });

  it("fills with new cards once the reviews run out, in plan order", () => {
    const s = sliceSession(plan, MIXED, 7, continentOf);
    expect(s.queue.map((q) => q.entityId)).toEqual([
      "NOR",
      "JPN",
      "SWE",
      "KEN",
      "CHN",
      "FIN",
      "DNK",
    ]);
  });

  it("holds fewer cards when the focus has fewer than the length", () => {
    const s = sliceSession(plan, { kind: "skill", id: "flags" }, 10, continentOf);
    expect(s.queue.map((q) => q.cardId).sort()).toEqual([
      "DNK:flag_to_name",
      "EGY:flag_to_name",
      "JPN:flag_to_name",
      "SWE:flag_to_name",
    ]);
    expect(s.available).toBe(4);
    // NOR, KEN, FIN are due and not flags.
    expect(s.dueOutside).toBe(3);
  });

  it("focuses on a module and on a continent", () => {
    expect(
      sliceSession(plan, { kind: "module", id: "cities" }, 5, continentOf).queue.map(
        (q) => q.cardId,
      ),
    ).toEqual(["Q1748:city_to_map"]);
    const europe = sliceSession(plan, { kind: "region", id: "europe" }, 20, continentOf);
    expect(europe.queue.every((q) => q.subregion === "154")).toBe(true);
    expect(europe.available).toBe(5);
    expect(europe.dueOutside).toBe(1);
    const east = sliceSession(plan, { kind: "region", id: "035" }, 20, continentOf);
    expect(east.queue.map((q) => q.entityId).sort()).toEqual(["CHN", "JPN"]);
  });

  it("never repeats an entity back to back after slicing", () => {
    const twins = [
      item("NOR", "154", "map_to_name"),
      item("SWE", "154", "flag_to_name"),
      item("NOR", "154", "flag_to_name"),
      item("FIN", "154", "map_to_name"),
    ];
    const s = sliceSession(twins, { kind: "region", id: "europe" }, 3, continentOf);
    for (let i = 1; i < s.queue.length; i++)
      expect(s.queue[i]?.entityId).not.toBe(s.queue[i - 1]?.entityId);
  });

  it("counts cards per focus for the picker", () => {
    const counts = focusCounts(
      plan,
      [MIXED, { kind: "skill", id: "location" }, { kind: "region", id: "africa" }],
      continentOf,
    );
    expect(counts.get("mixed")).toBe(9);
    expect(counts.get("skill:location")).toBe(3);
    expect(counts.get("region:africa")).toBe(2);
  });
});
