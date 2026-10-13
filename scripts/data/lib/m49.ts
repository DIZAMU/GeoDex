import type { Continent } from "../../../src/data/types.ts";
import { tableRows } from "./html.ts";

export type M49Row = {
  iso3: string;
  iso2: string;
  m49: string;
  regionName: string;
  subregionCode: string;
  subregionName: string;
};

/** Parses the English table on the UNSD M49 overview page. */
export function parseM49(html: string): M49Row[] {
  const start = html.indexOf('id = "downloadTableEN"');
  if (start < 0) throw new Error("M49 page layout changed: no downloadTableEN");
  const table = html.slice(start, html.indexOf("</table>", start));
  return tableRows(table)
    .filter((cells) => cells.length >= 12 && /^[A-Z]{3}$/.test(cells[11] ?? ""))
    .map((cells) => ({
      iso3: cells[11] ?? "",
      iso2: cells[10] ?? "",
      m49: cells[9] ?? "",
      regionName: cells[3] ?? "",
      // Intermediate region where M49 has one (Western Africa, Caribbean), else sub-region.
      subregionCode: cells[6] || (cells[4] ?? ""),
      subregionName: cells[7] || (cells[5] ?? ""),
    }));
}

const AMERICAS_SOUTH = new Set(["005"]);

export function continentOf(regionName: string, subregionCode: string): Continent {
  switch (regionName) {
    case "Africa":
      return "africa";
    case "Asia":
      return "asia";
    case "Europe":
      return "europe";
    case "Oceania":
      return "oceania";
    case "Americas":
      return AMERICAS_SOUTH.has(subregionCode) ? "south_america" : "north_america";
    default:
      throw new Error(`Unknown M49 region ${regionName}`);
  }
}
