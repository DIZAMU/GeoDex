/**
 * Content linter (PLAN.md Phase 3). Enforces the machine-checkable rules at the end of
 * content/VOICE.md, read from its YAML block, on entity content, confusions and templates,
 * in both locales. `--complete` also requires content for every country in scope.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import type { CitiesFile, CountriesFile } from "../../src/data/types.ts";
import { parseTemplateFile } from "../../src/engine/explain/template.ts";
import {
  type Confusion,
  type ContentGroupFile,
  HOOK_TYPES,
  type Locale,
  PLAIN_HOOK_TYPES,
  type Token,
} from "../../src/engine/explain/types.ts";

type Rules = {
  locales: Locale[];
  max_length: Record<
    "hook" | "capital_hook" | "fact" | "flag_note" | "contrast" | "template_body",
    number
  >;
  banned_characters: string[];
  banned_phrases: Record<Locale, string[]>;
  banned_words: Record<Locale, string[]>;
  digits_require_source: boolean;
  min_hooks_per_entity_per_locale: number;
  min_hook_types_per_entity_per_locale: number;
  require_plain_hook_per_locale: boolean;
  min_capital_hooks_per_country_per_locale: number;
  min_facts_per_entity: number;
  min_facts_per_city: number;
  facts_require_both_locales: boolean;
  template_ids_match_across_locales: boolean;
  no_duplicate_text: boolean;
  template_body_forbids: string[];
  hardcoded_nb_preposition: string;
};

export function readRules(voicePath = "content/VOICE.md"): Rules {
  const source = readFileSync(voicePath, "utf8");
  const block = source.match(/## Machine-checkable rules[\s\S]*?```yaml\n([\s\S]*?)```/);
  if (!block?.[1]) throw new Error("VOICE.md has no machine-checkable YAML block");
  return parse(block[1]) as Rules;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Problems with one piece of learner-facing text. */
export function textProblems(
  text: string,
  locale: Locale,
  kind: keyof Rules["max_length"],
  rules: Rules,
): string[] {
  const problems: string[] = [];
  if (!text.trim()) return ["empty text"];
  if (text.length > rules.max_length[kind])
    problems.push(`${kind} is ${text.length} characters, max ${rules.max_length[kind]}`);
  for (const ch of rules.banned_characters) {
    if (text.includes(ch))
      problems.push(`banned character U+${ch.codePointAt(0)?.toString(16).toUpperCase()}`);
  }
  const lower = text.toLowerCase();
  for (const phrase of rules.banned_phrases[locale] ?? []) {
    if (lower.includes(phrase)) problems.push(`banned phrase "${phrase}"`);
  }
  for (const word of rules.banned_words[locale] ?? []) {
    if (new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}($|[^\\p{L}])`, "iu").test(text))
      problems.push(`banned word "${word}"`);
  }
  if (locale === "nb" && text.includes('"')) problems.push("straight quotes in Norwegian, use « »");
  if (/\s[,.]/.test(text)) problems.push("space before punctuation");
  if (/ {2}/.test(text)) problems.push("double space");
  return problems;
}

function bodyText(tokens: readonly Token[]): string {
  return tokens
    .map((t) => (t.kind === "text" ? t.text : t.kind === "slot" ? `{${t.path}}` : bodyText(t.body)))
    .join("");
}

export function lintContent(
  options: { root?: string; complete?: boolean; countriesPath?: string; citiesPath?: string } = {},
): string[] {
  const root = options.root ?? "content";
  const rules = readRules(`${root}/VOICE.md`);
  const errors: string[] = [];
  const countries = JSON.parse(
    readFileSync(options.countriesPath ?? "data/countries.json", "utf8"),
  ) as CountriesFile;
  const byId = new Map(countries.countries.map((c) => [c.id, c]));
  const citiesPath = options.citiesPath ?? "data/cities.json";
  const cities = existsSync(citiesPath)
    ? (JSON.parse(readFileSync(citiesPath, "utf8")) as CitiesFile).cities
    : [];
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const ids = new Set<string>();
  const texts: Record<Locale, Map<string, string>> = { en: new Map(), nb: new Map() };
  const seenEntities = new Set<string>();

  const check = (where: string, text: string, locale: Locale, kind: keyof Rules["max_length"]) => {
    for (const p of textProblems(text, locale, kind, rules))
      errors.push(`${where} [${locale}]: ${p}`);
    if (rules.no_duplicate_text && text.trim()) {
      const key = text.trim().toLowerCase();
      const other = texts[locale].get(key);
      if (other) errors.push(`${where} [${locale}]: same text as ${other}`);
      else texts[locale].set(key, where);
    }
  };
  const claimId = (where: string, id: string) => {
    if (!id) errors.push(`${where}: missing id`);
    else if (ids.has(id)) errors.push(`${where}: duplicate id ${id}`);
    ids.add(id);
  };

  // Countries are grouped by subregion; cities by the continent of their country.
  const modules = [
    {
      name: "countries",
      groupOf: (id: string) => byId.get(id)?.subregion,
      minFacts: rules.min_facts_per_entity,
      countryExtras: true,
    },
    {
      name: "cities",
      groupOf: (id: string) => {
        const city = cityById.get(id);
        return city ? byId.get(city.countryId)?.continent : undefined;
      },
      minFacts: rules.min_facts_per_city,
      countryExtras: false,
    },
  ];
  for (const module of modules) {
    const dir = `${root}/entities/${module.name}`;
    const files = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".json"))
          .sort()
      : [];
    for (const file of files) {
      const group = JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as ContentGroupFile;
      if (`${group.group}.json` !== file)
        errors.push(`${module.name}/${file}: group "${group.group}" does not match the file name`);
      for (const e of group.entities) {
        const at = `${module.name}/${file}:${e.entityId}`;
        const expected = module.groupOf(e.entityId);
        if (!expected) {
          errors.push(`${at}: unknown entity`);
          continue;
        }
        if (expected !== group.group) errors.push(`${at}: belongs in ${expected}.json`);
        if (seenEntities.has(e.entityId)) errors.push(`${at}: entity appears twice`);
        seenEntities.add(e.entityId);

        for (const locale of rules.locales) {
          const hooks = e.hooks?.[locale] ?? [];
          if (hooks.length < rules.min_hooks_per_entity_per_locale)
            errors.push(
              `${at} [${locale}]: ${hooks.length} hooks, need ${rules.min_hooks_per_entity_per_locale}`,
            );
          const types = new Set(hooks.map((h) => h.type));
          if (types.size < rules.min_hook_types_per_entity_per_locale)
            errors.push(
              `${at} [${locale}]: ${types.size} hook types, need ${rules.min_hook_types_per_entity_per_locale}`,
            );
          if (
            rules.require_plain_hook_per_locale &&
            !hooks.some((h) => PLAIN_HOOK_TYPES.includes(h.type))
          )
            errors.push(`${at} [${locale}]: no plain hook (anchor, etymology or contrast)`);
          for (const h of hooks) {
            claimId(at, h.id);
            if (!HOOK_TYPES.includes(h.type))
              errors.push(`${at}:${h.id}: unknown hook type ${h.type}`);
            check(`${at}:${h.id}`, h.text, locale, "hook");
          }
          const capitalHooks = e.capitalHooks?.[locale] ?? [];
          if (!module.countryExtras) {
            if (capitalHooks.length > 0 || e.flagNote)
              errors.push(`${at}: capital hooks and flag notes are for countries only`);
            continue;
          }
          if (capitalHooks.length < rules.min_capital_hooks_per_country_per_locale)
            errors.push(
              `${at} [${locale}]: ${capitalHooks.length} capital hooks, need ${rules.min_capital_hooks_per_country_per_locale}`,
            );
          for (const h of capitalHooks) {
            claimId(at, h.id);
            if (!HOOK_TYPES.includes(h.type))
              errors.push(`${at}:${h.id}: unknown hook type ${h.type}`);
            check(`${at}:${h.id}`, h.text, locale, "capital_hook");
          }
          if (e.flagNote) check(`${at}:flagNote`, e.flagNote[locale] ?? "", locale, "flag_note");
        }
        if (module.countryExtras && !e.flagNote) errors.push(`${at}: no flagNote`);

        if (e.facts.length < module.minFacts)
          errors.push(`${at}: ${e.facts.length} facts, need ${module.minFacts}`);
        for (const f of e.facts) {
          claimId(at, f.id);
          if (![1, 2, 3].includes(f.tier)) errors.push(`${at}:${f.id}: tier must be 1, 2 or 3`);
          if (typeof f.verified !== "boolean")
            errors.push(`${at}:${f.id}: verified must be true or false`);
          for (const locale of rules.locales) {
            const text = f.text?.[locale] ?? "";
            if (rules.facts_require_both_locales && !text)
              errors.push(`${at}:${f.id} [${locale}]: missing text`);
            else check(`${at}:${f.id}`, text, locale, "fact");
            if (rules.digits_require_source && /\d/.test(text) && !f.sourceUrl)
              errors.push(`${at}:${f.id} [${locale}]: digits need a sourceUrl`);
          }
          if (f.sourceUrl && !/^https:\/\/\S+$/.test(f.sourceUrl))
            errors.push(`${at}:${f.id}: sourceUrl must be an https URL`);
        }
      }
    }
  }

  if (options.complete) {
    for (const c of countries.countries) {
      if ((c.status === "un_member" || c.status === "un_observer") && !seenEntities.has(c.id))
        errors.push(`${c.id}: no content`);
    }
    for (const c of cities)
      if (!seenEntities.has(c.id)) errors.push(`${c.id} (${c.names.en}): no content`);
  }

  const confusionsPath = `${root}/confusions.json`;
  if (existsSync(confusionsPath)) {
    const { confusions } = JSON.parse(readFileSync(confusionsPath, "utf8")) as {
      confusions: Confusion[];
    };
    const pairs = new Set<string>();
    for (const c of confusions) {
      const at = `confusions:${c.a}|${c.b}`;
      const key = [c.a, c.b].sort().join("|") + c.dimension;
      if (pairs.has(key)) errors.push(`${at}: duplicate pair`);
      pairs.add(key);
      for (const locale of rules.locales) check(at, c.contrast?.[locale] ?? "", locale, "contrast");
    }
  }

  const preposition = new RegExp(rules.hardcoded_nb_preposition);
  for (const locale of rules.locales) {
    const tdir = `${root}/templates/${locale}`;
    if (!existsSync(tdir)) continue;
    for (const file of readdirSync(tdir)
      .filter((f) => f.endsWith(".md"))
      .sort()) {
      const source = readFileSync(`${tdir}/${file}`, "utf8");
      let templates: ReturnType<typeof parseTemplateFile> = [];
      try {
        templates = parseTemplateFile(source, `${tdir}/${file}`);
      } catch (error) {
        errors.push((error as Error).message);
        continue;
      }
      for (const t of templates) {
        const text = bodyText(t.body);
        for (const p of textProblems(text, locale, "template_body", rules))
          errors.push(`${locale}/${file}:${t.id}: ${p}`);
        for (const banned of rules.template_body_forbids) {
          if (text.includes(banned)) errors.push(`${locale}/${file}:${t.id}: contains "${banned}"`);
        }
        if (locale === "nb" && preposition.test(text))
          errors.push(`${locale}/${file}:${t.id}: hardcoded "i", use {target.inName}`);
      }
    }
  }
  return errors;
}

if (import.meta.main) {
  const errors = lintContent({ complete: process.argv.includes("--complete") });
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    console.error(`\n${errors.length} content problems.`);
    process.exit(1);
  }
  console.log("Content lint passed.");
}
