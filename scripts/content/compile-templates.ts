/**
 * Compiles content/templates/<locale>/<moment>.md into src/generated/templates.json
 * (PLAN.md 7.3). Fails on syntax errors, unknown slots, a moment that does not match its
 * file, duplicate ids, or an id present in one locale but not the other.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { KNOWN_SLOTS } from "../../src/engine/explain/slots.ts";
import { parseTemplateFile, slotPaths } from "../../src/engine/explain/template.ts";
import type { Locale, Template, TemplatesFile } from "../../src/engine/explain/types.ts";

const LOCALES: Locale[] = ["en", "nb"];
const ROOT = "content/templates";
const OUT = "src/generated/templates.json";

export function compileTemplates(root = ROOT): TemplatesFile {
  const known = new Set<string>(KNOWN_SLOTS);
  const errors: string[] = [];
  const out = { en: [], nb: [] } as TemplatesFile;
  for (const locale of LOCALES) {
    const files = readdirSync(`${root}/${locale}`)
      .filter((f) => f.endsWith(".md"))
      .sort();
    const seen = new Set<string>();
    for (const file of files) {
      const path = `${root}/${locale}/${file}`;
      let templates: Template[] = [];
      try {
        templates = parseTemplateFile(readFileSync(path, "utf8"), path);
      } catch (error) {
        errors.push((error as Error).message);
        continue;
      }
      for (const t of templates) {
        if (`${t.moment}.md` !== file) errors.push(`${path}: ${t.id} has moment ${t.moment}`);
        if (seen.has(t.id)) errors.push(`${path}: duplicate id ${t.id}`);
        seen.add(t.id);
        const used = [...slotPaths(t.body), ...t.requires, ...t.when.map((w) => w.path)];
        for (const slot of used) {
          if (!known.has(slot)) errors.push(`${path}: ${t.id} uses unknown slot ${slot}`);
        }
        out[locale].push(t);
      }
    }
    out[locale].sort((a, b) => a.id.localeCompare(b.id));
  }
  const ids = (l: Locale) => new Set(out[l].map((t) => t.id));
  for (const [a, b] of [
    ["en", "nb"],
    ["nb", "en"],
  ] as const) {
    for (const id of ids(a)) if (!ids(b).has(id)) errors.push(`${id} exists in ${a} but not ${b}`);
  }
  if (errors.length > 0) throw new Error(`Template compile failed:\n${errors.join("\n")}`);
  return out;
}

if (import.meta.main) {
  const templates = compileTemplates();
  mkdirSync("src/generated", { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(templates, null, 2)}\n`);
  console.log(`Compiled ${templates.en.length} templates per locale into ${OUT}.`);
}
