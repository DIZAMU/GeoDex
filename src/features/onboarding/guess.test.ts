import { describe, expect, it } from "vitest";
import type { Country } from "@/data/types";
import { guessHomeCountry } from "./CountryPicker";

const c = (id: string, iso2: string) => ({ id, iso2 }) as Country;
const countries = [c("NOR", "no"), c("GBR", "gb"), c("USA", "us")];

describe("guessHomeCountry", () => {
  it("uses the region of the first browser language that has one", () => {
    expect(guessHomeCountry(["en-GB", "nb-NO"], countries)).toBe("GBR");
    expect(guessHomeCountry(["nb-NO"], countries)).toBe("NOR");
  });

  it("falls back to Norway for a bare Norwegian tag and null otherwise", () => {
    expect(guessHomeCountry(["nb"], countries)).toBe("NOR");
    expect(guessHomeCountry(["de"], countries)).toBeNull();
  });
});
