import { describe, expect, it } from "vitest";
import { allowedLicense, landmarkImages, plainText } from "./landmarks.ts";

describe("landmark image rules", () => {
  it("allows public domain, CC0, CC BY and CC BY-SA only", () => {
    for (const ok of [
      "Public domain",
      "PD-US",
      "CC0",
      "CC BY 2.0",
      "CC BY-SA 4.0",
      "CC BY-SA 2.0 at",
    ])
      expect(allowedLicense(ok), ok).toBe(true);
    for (const no of [
      "FAL",
      "GFDL",
      "Attribution",
      "CC BY-NC 2.0",
      "CC BY-ND 4.0",
      "CC BY-NC-SA 3.0",
      "",
    ])
      expect(allowedLicense(no), no).toBe(false);
  });

  it("turns Commons author HTML into plain text", () => {
    expect(plainText('<a href="//commons.wikimedia.org/wiki/User:Benh">Benh LIEU SONG</a>')).toBe(
      "Benh LIEU SONG",
    );
    expect(plainText("Tom &amp; Jerry&nbsp; <b>x</b>")).toBe("Tom & Jerry x");
  });

  it("prefers the seed's image over Wikidata's", () => {
    const seed = {
      landmarks: ["Q1", "Q2", "Q3"],
      country: {},
      image: { Q2: "B b.jpg" },
      names: {},
      aliases: {},
      credit: {},
    };
    const images = landmarkImages(
      seed,
      new Map([
        ["Q1", "A a.jpg"],
        ["Q2", "x.jpg"],
      ]),
    );
    expect([...images]).toEqual([
      ["Q1", "A_a.jpg"],
      ["Q2", "B_b.jpg"],
    ]);
  });
});
