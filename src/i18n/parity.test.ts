import { describe, expect, it } from "vitest";
import en from "./en.json";
import nb from "./nb.json";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (typeof value !== "object" || value === null) throw new Error(`Unexpected value at ${prefix}`);
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("locale files", () => {
  it("have exactly the same keys", () => {
    expect(keyPaths(nb).sort()).toEqual(keyPaths(en).sort());
  });

  it("have no empty strings", () => {
    for (const file of [en, nb]) {
      const empty = keyPaths(file).filter((path) => {
        const value = path.split(".").reduce<unknown>((node, key) => {
          return (node as Record<string, unknown>)[key];
        }, file);
        return typeof value === "string" && value.trim() === "";
      });
      expect(empty).toEqual([]);
    }
  });
});
