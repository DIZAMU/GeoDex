// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CountriesFile } from "../../src/data/types.ts";
import { buildIndex, checkPiece, factCheck, type Piece } from "./facts.ts";

const countries = (JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile)
  .countries;
const index = buildIndex(countries);
const check = (text: string, locale: "en" | "nb" = "en", entity: string | null = null) =>
  checkPiece({ where: "test", locale, text, entity } satisfies Piece, index).map(
    (f) => `${f.level}:${f.kind}`,
  );

describe("fact check", () => {
  it("catches a wrong capital, border, coast and superlative", () => {
    expect(check("Sydney is the capital of Australia.")).toEqual([]);
    expect(check("Canberra is the capital of Austria.")).toEqual(["error:capital"]);
    expect(check("Norway borders Sweden, Finland and Russia.")).toEqual([]);
    expect(check("Norway borders Sweden and Denmark.")).toEqual(["error:border"]);
    expect(check("Bolivia is landlocked.")).toEqual([]);
    expect(check("Peru is landlocked.")).toEqual(["error:landlocked"]);
    expect(check("Mali has a long coast.")).toEqual(["error:landlocked"]);
    expect(check("Russia is the largest country in the world.")).toEqual([]);
    expect(check("Canada is the largest country in the world.")).toEqual(["error:superlative"]);
    expect(check("Vatikanstaten er det minste landet i verden.", "nb")).toEqual([]);
  });

  it("checks Norwegian claims too", () => {
    expect(check("Norge grenser til Sverige, Finland og Russland.", "nb")).toEqual([]);
    expect(check("Norge grenser til Danmark.", "nb")).toEqual(["error:border"]);
    expect(check("Peru er en innlandsstat.", "nb")).toEqual(["error:landlocked"]);
  });

  it("knows the short Botswana and Zambia border", () => {
    expect(check("Botswana borders Zambia at Kazungula.")).toEqual([]);
  });

  it("leaves negations, exceptions and other places alone", () => {
    expect(check("Peru is not landlocked.")).toEqual([]);
    expect(check("Brazil borders every country there except Chile and Ecuador.")).toEqual([]);
    expect(check("The West Bank is landlocked.", "en", "PSE")).toEqual([]);
    expect(
      check("Uruguay has an Atlantic coast; Paraguay, upriver, is landlocked.", "en", "URY"),
    ).toEqual([]);
  });

  it("needs a capital hook to name the capital", () => {
    const hook = (text: string) =>
      checkPiece({ where: "test", locale: "en", text, entity: "NOR" }, index, true).length;
    expect(hook("Oslo sits at the head of a long fjord.")).toBe(0);
    expect(hook("The capital sits at the head of a long fjord.")).toBe(1);
  });

  it("finds no errors in the committed content", () => {
    const { findings } = factCheck(countries);
    expect(findings.filter((f) => f.level === "error")).toEqual([]);
  });
});
