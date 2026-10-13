import { describe, expect, it } from "vitest";
import { expandVariants, parseSprakradet } from "./sprakradet.ts";

describe("expandVariants", () => {
  it("expands optional letters, shorter form first", () => {
    expect(expandVariants("Elfenbe(i)nskysten")).toEqual(["Elfenbenskysten", "Elfenbeinskysten"]);
    expect(expandVariants("Luxemb(o)urg")).toEqual(["Luxemburg", "Luxembourg"]);
  });

  it("treats a parenthesis after a word as an alternative for it", () => {
    expect(expandVariants("Saint (St.) Lucia")).toEqual(["Saint Lucia", "St. Lucia"]);
  });

  it("treats a leading parenthesis as optional", () => {
    expect(expandVariants("(Føderasjonen) Saint (St.) Kitts og Nevis")).toEqual([
      "Saint Kitts og Nevis",
      "St. Kitts og Nevis",
      "Føderasjonen Saint Kitts og Nevis",
      "Føderasjonen St. Kitts og Nevis",
    ]);
  });

  it("splits el. alternatives", () => {
    expect(expandVariants("Myanmar el. Burma")).toEqual(["Myanmar", "Burma"]);
  });
});

describe("parseSprakradet", () => {
  const html = `<h2>Offisielt navn</h2><table>
    <tr><th>Kortnavn</th><th>Offisielt navn</th></tr>
    <tr><td>Østerrike/Austerrike</td><td>Republikken Østerrike / Republikken Austerrike</td></tr>
    <tr><td>Elfenbe(i)nskysten (bm.)</td><td>Republikken Elfenbe(i)nskysten</td></tr>
    <tr><td>Elfenbeinskysten (nyn.)</td><td>Republikken Elfenbeinskysten</td></tr>
    <tr><td>De forente arabiske emirater (bm.)</td><td>også offisielt navn</td></tr>
  </table>`;

  it("keeps Bokmål forms and drops Nynorsk rows", () => {
    expect(parseSprakradet(html)).toEqual([
      { names: ["Østerrike"], official: "Republikken Østerrike" },
      {
        names: ["Elfenbenskysten", "Elfenbeinskysten"],
        official: "Republikken Elfenbenskysten",
      },
      { names: ["De forente arabiske emirater"], official: "De forente arabiske emirater" },
    ]);
  });
});
