// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = readdirSync("src/engine", { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

describe("engine purity", () => {
  it.each(files)("%s imports no React, Dexie or app code", (file) => {
    const source = readFileSync(`src/engine/${file}`, "utf8");
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] ?? "");
    for (const spec of imports) {
      expect(spec, file).not.toMatch(
        /^(react|react-dom|dexie|dexie-react-hooks|react-i18next|i18next)(\/|$)/,
      );
      expect(spec, file).not.toMatch(/^@\/(?!engine\/)/);
    }
  });
});
