import { describe, expect, it } from "vitest";
import {
  gradeTaps,
  groupCardTypes,
  groupNameDistractors,
  groupReady,
  MAX_TAP_MEMBERS,
  pickFromPools,
  pickMember,
} from "./groups";
import { createRng } from "./random";

describe("group cards", () => {
  it("skip tapping for large groups", () => {
    expect(groupCardTypes(3)).toEqual(["group_to_map", "map_to_group", "group_member"]);
    expect(groupCardTypes(MAX_TAP_MEMBERS)).toContain("group_to_map");
    expect(groupCardTypes(27)).toEqual(["map_to_group", "group_member"]);
  });

  it("start once half the members are introduced", () => {
    expect(groupReady(1, 3)).toBe(false);
    expect(groupReady(2, 3)).toBe(true);
    expect(groupReady(1, 2)).toBe(true);
    expect(groupReady(0, 0)).toBe(false);
  });
});

describe("tap grading", () => {
  const members = ["DNK", "NOR", "SWE"];
  const sometimes = ["FIN", "ISL"];

  it("is Good with every member and nothing else", () => {
    expect(gradeTaps(members, sometimes, ["SWE", "NOR", "DNK"])).toEqual({
      missed: [],
      wrong: [],
      rating: 3,
      correct: true,
    });
  });

  it("ignores sometimes members", () => {
    expect(gradeTaps(members, sometimes, ["SWE", "NOR", "DNK", "FIN"]).rating).toBe(3);
  });

  it("is Hard after one slip and Again after two", () => {
    expect(gradeTaps(members, sometimes, ["SWE", "NOR"])).toMatchObject({
      missed: ["DNK"],
      rating: 2,
      correct: true,
    });
    expect(gradeTaps(members, sometimes, ["SWE", "NOR", "DNK", "EST"])).toMatchObject({
      wrong: ["EST"],
      rating: 2,
    });
    expect(gradeTaps(members, sometimes, ["SWE", "EST"])).toMatchObject({
      missed: ["DNK", "NOR"],
      wrong: ["EST"],
      rating: 1,
      correct: false,
    });
    expect(gradeTaps(members, sometimes, []).rating).toBe(1);
  });
});

describe("group distractors", () => {
  it("take near pools first, without repeats or excluded ids", () => {
    const picked = pickFromPools(
      [["A", "B"], ["B", "C", "D"], ["E"]],
      new Set(["A"]),
      3,
      createRng(1),
    );
    expect(picked).toHaveLength(3);
    expect(picked).toContain("B");
    expect(picked).not.toContain("A");
    expect(new Set(picked).size).toBe(3);
  });

  it("is deterministic per seed", () => {
    const pools = [["A", "B", "C", "D", "E", "F"]];
    expect(pickFromPools(pools, new Set(), 3, createRng("s"))).toEqual(
      pickFromPools(pools, new Set(), 3, createRng("s")),
    );
    expect(pickMember(["A", "B", "C"], "x")).toBe(pickMember(["A", "B", "C"], "x"));
  });

  it("offer overlapping groups as wrong names first", () => {
    const continent = (id: string) =>
      ["DNK", "NOR", "SWE", "FIN", "ISL", "EST"].includes(id) ? "europe" : "asia";
    const groups = [
      { id: "nordic", members: ["DNK", "FIN", "ISL", "NOR", "SWE"] },
      { id: "scandinavia", members: ["DNK", "NOR", "SWE"] },
      { id: "baltic", members: ["EST"] },
      { id: "korea", members: ["KOR", "PRK"] },
    ];
    const nordic = groups[0] as (typeof groups)[number];
    const names = groupNameDistractors(nordic, groups, continent, 2, createRng(3));
    expect(names).toEqual(["scandinavia", "baltic"]);
    expect(groupNameDistractors(nordic, groups, continent, 3, createRng(3))).toContain("korea");
  });
});
