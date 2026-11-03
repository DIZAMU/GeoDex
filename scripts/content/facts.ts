/**
 * Fact check (docs/PLAN-2.0.md, stage 5). Reads every hook, capital hook, flag note, fact and
 * contrast, in both languages, finds claims the data can settle, and checks them against
 * data/countries.json:
 *
 * - a capital hook names one of its country's capitals;
 * - "X is the capital of Y" names a real capital of Y;
 * - "A borders B" names a real neighbour;
 * - "landlocked" or "no coast" is said only of landlocked countries, a coast only of others;
 * - "the official language" names an official language;
 * - "the currency" names the country's own currency;
 * - "the largest, smallest, most or least populous country in <continent or the world>"
 *   holds by area or population.
 *
 * A claim is about the country named closest before it in its sentence, or else the entry's
 * own country. Sentences with a negation are left alone. Errors fail the run; notes are
 * things a person should glance at. The report goes to content/FACT-CHECK.md.
 *
 * Usage: node scripts/content/facts.ts [--report path]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { CountriesFile, Country } from "../../src/data/types.ts";
import type {
  Confusion,
  ContentGroupFile,
  EntityContent,
  Locale,
} from "../../src/engine/explain/types.ts";

export type Finding = {
  level: "error" | "note";
  kind: string;
  where: string;
  locale: Locale;
  text: string;
  problem: string;
};

export type Piece = { where: string; locale: Locale; text: string; entity: string | null };

const LOCALES: Locale[] = ["en", "nb"];
const NEGATION: Record<Locale, RegExp> = {
  en: /\b(not|never|neither|nor|no longer|isn't|wasn't|unlike|instead of|rather than|formerly|once|until)\b/i,
  nb: /\b(ikke|aldri|verken|i motsetning til|i stedet for|tidligere|en gang|frem til|fram til)\b/i,
};
const CONTINENTS: Record<string, Record<Locale, string[]>> = {
  africa: { en: ["Africa"], nb: ["Afrika"] },
  asia: { en: ["Asia"], nb: ["Asia"] },
  europe: { en: ["Europe"], nb: ["Europa"] },
  north_america: { en: ["North America"], nb: ["Nord-Amerika"] },
  south_america: { en: ["South America"], nb: ["Sør-Amerika"] },
  oceania: { en: ["Oceania"], nb: ["Oseania"] },
  world: { en: ["the world"], nb: ["verden"] },
};

/** Aliases that are also parts of continent names ("South America") and so name no country. */
const AMBIGUOUS = new Set(["America", "Amerika"]);
/** Words in capital names too generic to show which capital a hook is about. */
const GENERIC = new Set([
  "South",
  "North",
  "East",
  "West",
  "City",
  "District",
  "Saint",
  "San",
  "Santo",
  "Port",
  "New",
  "Town",
]);

const lower = (s: string) => s.toLocaleLowerCase("en");
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A whole-word, case-sensitive alternation of names, longest first. */
function alternation(names: Iterable<string>): RegExp {
  const sorted = [...new Set(names)]
    .filter((n) => n.length > 1)
    .sort((a, b) => b.length - a.length);
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(${sorted.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
    "gu",
  );
}
/**
 * Sentences, cut further into clauses where a second claim about another country starts:
 * at a semicolon, and at "while", "whereas" or "mens" after a comma.
 */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?;])\s+|,\s+(?=(?:while|whereas|mens)\b)/).filter(Boolean);
}

export function buildIndex(countries: readonly Country[]) {
  const byId = new Map(countries.map((c) => [c.id, c]));
  /** Country names per locale, mapped to ids; a name shared by two countries maps to null. */
  const names: Record<Locale, Map<string, string | null>> = { en: new Map(), nb: new Map() };
  const capitals = new Map<string, Set<string>>();
  const currencies: Record<Locale, Map<string, Set<string>>> = { en: new Map(), nb: new Map() };
  const languages: Record<Locale, Map<string, Set<string>>> = { en: new Map(), nb: new Map() };
  const add = (map: Map<string, Set<string>>, key: string, id: string) => {
    const set = map.get(key) ?? new Set();
    set.add(id);
    map.set(key, set);
  };
  for (const c of countries) {
    for (const locale of LOCALES) {
      for (const n of [
        c.names[locale],
        c.officialNames?.[locale],
        ...(c.aliases?.[locale] ?? []),
      ]) {
        if (!n || AMBIGUOUS.has(n)) continue;
        const seen = names[locale].get(n);
        names[locale].set(n, seen === undefined || seen === c.id ? c.id : null);
      }
      for (const cur of c.currencies) add(currencies[locale], lower(cur.names[locale]), c.id);
      for (const lang of c.officialLanguages)
        add(languages[locale], lower(lang.names[locale]), c.id);
    }
    for (const cap of c.capitals) {
      for (const n of [cap.names.en, cap.names.nb, ...cap.aliases.en, ...cap.aliases.nb])
        add(capitals, n, c.id);
    }
  }
  return {
    byId,
    names,
    nameRe: { en: alternation(names.en.keys()), nb: alternation(names.nb.keys()) },
    capitals,
    capitalRe: alternation(capitals.keys()),
    currencies,
    currencyRe: {
      en: alternation([...currencies.en.keys()]),
      nb: alternation([...currencies.nb.keys()]),
    },
    languages,
    languageRe: {
      en: alternation([...languages.en.keys()]),
      nb: alternation([...languages.nb.keys()]),
    },
  };
}
type Index = ReturnType<typeof buildIndex>;

/** Country names in a sentence, with their positions. */
function countriesIn(sentence: string, locale: Locale, index: Index) {
  return [...sentence.matchAll(index.nameRe[locale])].map((m) => ({
    at: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    id: index.names[locale].get(m[0]) ?? null,
    name: m[0],
  }));
}

/**
 * The country a claim at `at` is about. A sentence that opens with a country is about it
 * ("Djibouti borders Eritrea and Ethiopia, and has a coast"). Otherwise the closest country
 * named before the claim in the same clause, or else the entry's own country when no other
 * country comes first. Anything else is unclear and left alone.
 */
function subjectAt(
  sentence: string,
  at: number,
  locale: Locale,
  index: Index,
  entity: string | null,
): string | null {
  const named = countriesIn(sentence, locale, index);
  const opening = named[0];
  if (opening && /^(?:the |det |den )?$/i.test(sentence.slice(0, opening.at))) return opening.id;
  // A clause that opens with another proper name ("The West Bank is landlocked") is about
  // that place, which the data does not know.
  if (/^(?:The|Det|Den)\s+\p{Lu}/u.test(sentence)) return null;
  const before = named.filter((m) => m.end <= at);
  const last = before.at(-1);
  if (last) return /[,;:]/.test(sentence.slice(last.end, at)) ? null : last.id;
  return entity;
}

function rank(index: Index, id: string, scope: string, by: "areaKm2" | "population"): number {
  const pool = [...index.byId.values()].filter(
    (c) => !c.markerOnly && (scope === "world" || c.continent === scope),
  );
  const sorted = pool.sort((a, b) => (b[by] ?? 0) - (a[by] ?? 0));
  return sorted.findIndex((c) => c.id === id) + 1;
}

/** How many claims of each kind were checked, for the report. */
export type Counts = Record<string, number>;

export function checkPiece(
  piece: Piece,
  index: Index,
  isCapitalHook = false,
  counts: Counts = {},
): Finding[] {
  const out: Finding[] = [];
  const count = (kind: string) => {
    counts[kind] = (counts[kind] ?? 0) + 1;
  };
  const { locale, text, entity } = piece;
  const finding = (level: Finding["level"], kind: string, problem: string) =>
    out.push({ level, kind, where: piece.where, locale, text, problem });
  const nameOf = (id: string | null) => (id ? (index.byId.get(id)?.names[locale] ?? id) : "?");

  // A capital hook names one of its country's capitals.
  if (isCapitalHook && entity) {
    const country = index.byId.get(entity);
    const own = (country?.capitals ?? []).flatMap((c) => [
      c.names[locale],
      ...c.aliases[locale],
      c.names.en,
    ]);
    const words = own
      .flatMap((n) => n.split(/[\s-]+/))
      .filter((w) => w.length >= 4 && !GENERIC.has(w));
    const mentions = (w: string) =>
      new RegExp(`(?<![\\p{L}])${escapeRegExp(w)}(?![\\p{L}])`, "u").test(text);
    count("capital hook");
    if (country && !own.some((n) => text.includes(n)) && !words.some(mentions))
      finding("error", "capital", `names none of ${nameOf(entity)}'s capitals (${own[0]})`);
  }

  for (const sentence of sentences(text)) {
    const negated = NEGATION[locale].test(sentence);

    // "X is the capital of Y" / "X er hovedstaden i Y".
    const capitalClaim =
      locale === "en"
        ? /is (?:the|its) capital(?: city)? of (?:the )?/g
        : /er hovedstad(?:en)? (?:i|på|til) /g;
    for (const m of sentence.matchAll(capitalClaim)) {
      if (negated) break;
      const at = m.index ?? 0;
      const head = sentence.slice(0, at).trimEnd();
      const cap = [...head.matchAll(index.capitalRe)].at(-1);
      if (!cap || (cap.index ?? 0) + cap[0].length !== head.length) continue;
      const tail = sentence.slice(at + m[0].length);
      const target = countriesIn(tail, locale, index)[0];
      if (target?.at !== 0 || !target.id) continue;
      count("capital");
      if (!index.capitals.get(cap[0])?.has(target.id))
        finding("error", "capital", `${cap[0]} is not a capital of ${target.name}`);
    }

    // Borders.
    const borderClaim =
      locale === "en"
        ? /\b(?:borders?|bordering|shares? a border with)\s+/g
        : /\bgrenser?(?:\s+(?:til|mot))\s+/g;
    for (const m of sentence.matchAll(borderClaim)) {
      if (negated) break;
      const at = m.index ?? 0;
      const subject = subjectAt(sentence, at, locale, index, entity);
      if (!subject) continue;
      // The names right after the verb: "Poland", "Poland and Hungary", "Chad, Niger and Mali".
      const tail = sentence.slice(at + m[0].length);
      const listed: ReturnType<typeof countriesIn> = [];
      for (const n of countriesIn(tail, locale, index)) {
        const prev = listed.at(-1);
        const gap = tail.slice(prev?.end ?? 0, n.at);
        if (prev ? !/^(?:,\s*|\s+(?:and|og)\s+|,\s*(?:and|og)\s+)$/.test(gap) : n.at !== 0) break;
        listed.push(n);
      }
      const neighbors = new Set(index.byId.get(subject)?.neighbors ?? []);
      for (const n of listed) {
        count("border");
        if (n.id && n.id !== subject && !neighbors.has(n.id))
          finding("error", "border", `${nameOf(subject)} does not border ${n.name}`);
      }
    }

    // Landlocked or not.
    const noCoast =
      locale === "en"
        ? /\b(landlocked|has no coast(?:line)?|no coastline|no sea coast)\b(?!\s+(?:on|along|to)\b)/g
        : /\b(innlandsstat|har ingen kyst(?:linje)?|uten kyst(?:linje)?|ingen kystlinje)\b(?!\s+(?:mot|til|langs)\b)/g;
    for (const m of sentence.matchAll(noCoast)) {
      if (negated) break;
      const subject = subjectAt(sentence, m.index ?? 0, locale, index, entity);
      const country = subject ? index.byId.get(subject) : undefined;
      if (country) count("landlocked");
      if (country && !country.landlocked)
        finding("error", "landlocked", `${nameOf(subject)} is not landlocked`);
    }
    const coast =
      locale === "en"
        ? /\b(?:has|have|with) (?:a |the |its |their )?(?:long |short |only )?(?:coast|coastline)\b/g
        : /\b(?:har|med) (?:en |sin )?(?:lang |kort )?(?:kyst|kystlinje)\b/g;
    for (const m of sentence.matchAll(coast)) {
      if (negated) break;
      const subject = subjectAt(sentence, m.index ?? 0, locale, index, entity);
      const country = subject ? index.byId.get(subject) : undefined;
      if (country) count("coast");
      if (country?.landlocked)
        finding("error", "landlocked", `${nameOf(subject)} is landlocked but is given a coast`);
    }

    // Official languages.
    const officialClaim =
      locale === "en" ? /\bofficial languages?\b/ : /\boffisielle? språk(?:et)?\b/;
    if (officialClaim.test(sentence) && !negated) {
      const subject =
        entity ?? subjectAt(sentence, sentence.search(officialClaim), locale, index, entity);
      if (subject) {
        count("official language");
        for (const m of sentence.matchAll(index.languageRe[locale])) {
          // Language names can also be demonyms ("French Guiana"); only lower-case nb names
          // and capitalised en names are language mentions.
          if (!index.languages[locale].get(lower(m[0]))?.has(subject))
            finding(
              "note",
              "language",
              `${m[0]} is not an official language of ${nameOf(subject)} in the data`,
            );
        }
      }
    }

    // Currency.
    const currencyClaim = locale === "en" ? /\bcurrency\b/ : /\bvaluta(?:en)?\b/;
    if (currencyClaim.test(sentence) && !negated) {
      const subject =
        entity ?? subjectAt(sentence, sentence.search(currencyClaim), locale, index, entity);
      const country = subject ? index.byId.get(subject) : undefined;
      if (country) {
        count("currency");
        const own = country.currencies.flatMap((c) => {
          const full = lower(c.names[locale]);
          return [full, full.split(" ").at(-1) ?? full];
        });
        const named = [...sentence.matchAll(index.currencyRe[locale])].map((m) => lower(m[0]));
        for (const n of named) {
          if (!index.currencies[locale].get(n)?.has(country.id))
            finding("error", "currency", `${n} is not ${nameOf(subject)}'s currency in the data`);
        }
        if (named.length === 0 && !own.some((o) => lower(sentence).includes(o)))
          finding("note", "currency", `mentions a currency but not ${nameOf(subject)}'s own`);
      }
    }

    // Largest, smallest, most or least populous.
    const superlative =
      locale === "en"
        ? /\b(?:the )?(second |third )?(largest|biggest|smallest|most populous|least populous) country (?:in|of|on) (the world|Africa|Asia|Europe|North America|South America|Oceania)\b/g
        : /\b(nest |tredje )?(største|minste|folkerikeste|minst folkerike) land(?:et)? (?:i|på) (verden|Afrika|Asia|Europa|Nord-Amerika|Sør-Amerika|Oseania)\b/g;
    for (const m of sentence.matchAll(superlative)) {
      if (negated) break;
      const [, nth, kind = "", where = ""] = m;
      const scope = Object.entries(CONTINENTS).find(([, n]) => n[locale].includes(where))?.[0];
      const subject = subjectAt(sentence, m.index ?? 0, locale, index, entity);
      if (!scope || !subject) continue;
      count("superlative");
      const position = nth ? (/second|nest/.test(nth) ? 2 : 3) : 1;
      const by = /populous|folkerike/.test(kind) ? "population" : "areaKm2";
      const small = /smallest|least|minste|minst/.test(kind);
      const pool = [...index.byId.values()].filter(
        (c) => !c.markerOnly && (scope === "world" || c.continent === scope),
      ).length;
      const r = rank(index, subject, scope, by);
      const actual = small ? pool - r + 1 : r;
      if (actual !== position)
        finding(
          "error",
          "superlative",
          `${nameOf(subject)} ranks ${actual} of ${pool} by ${by === "areaKm2" ? "area" : "population"}${small ? " from the bottom" : ""}`,
        );
    }
  }
  return out;
}

/** Every checkable piece of text: entity content in all modules, and the contrasts. */
export function collectPieces(root = "content"): { piece: Piece; capitalHook: boolean }[] {
  const out: { piece: Piece; capitalHook: boolean }[] = [];
  const push = (where: string, locale: Locale, text: string, entity: string | null, cap = false) =>
    out.push({ piece: { where, locale, text, entity }, capitalHook: cap });
  for (const module of readdirSync(`${root}/entities`)) {
    for (const file of readdirSync(`${root}/entities/${module}`)) {
      const data = JSON.parse(
        readFileSync(`${root}/entities/${module}/${file}`, "utf8"),
      ) as ContentGroupFile;
      for (const e of data.entities as EntityContent[]) {
        // Only country entries speak about "their" country; other modules name theirs.
        const entity = module === "countries" ? e.entityId : null;
        const at = `${module}/${file} ${e.entityId}`;
        for (const locale of LOCALES) {
          for (const h of e.hooks[locale] ?? []) push(`${at} ${h.id}`, locale, h.text, entity);
          for (const h of e.capitalHooks?.[locale] ?? [])
            push(`${at} ${h.id}`, locale, h.text, entity, true);
          if (e.flagNote) push(`${at} flag`, locale, e.flagNote[locale], entity);
          for (const f of e.facts) push(`${at} ${f.id}`, locale, f.text[locale], entity);
        }
      }
    }
  }
  const confusions = JSON.parse(readFileSync(`${root}/confusions.json`, "utf8")) as {
    confusions: Confusion[];
  };
  for (const c of confusions.confusions) {
    for (const locale of LOCALES)
      push(`confusions ${c.a}/${c.b} ${c.dimension}`, locale, c.contrast[locale], null);
  }
  return out;
}

export function factCheck(countries: readonly Country[], root = "content") {
  const index = buildIndex(countries);
  const pieces = collectPieces(root);
  const counts: Counts = {};
  const findings = pieces.flatMap(({ piece, capitalHook }) =>
    checkPiece(piece, index, capitalHook, counts),
  );
  return { pieces: pieces.length, findings, counts };
}

function report(pieces: number, findings: Finding[], counts: Counts): string {
  const errors = findings.filter((f) => f.level === "error");
  const notes = findings.filter((f) => f.level === "note");
  const row = (f: Finding) =>
    `| ${f.kind} | ${f.where} (${f.locale}) | ${f.problem} | ${f.text.replace(/\|/g, "/")} |`;
  const table = (list: Finding[]) =>
    list.length === 0
      ? "None.\n"
      : `| Check | Where | Problem | Text |\n| --- | --- | --- | --- |\n${list.map(row).join("\n")}\n`;
  return `# Fact check

Generated by \`node scripts/content/facts.ts\`. Do not edit by hand.

Checked ${pieces} pieces of text in English and Norwegian against data/countries.json.
Claims found and checked:

${Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .map(([kind, n]) => `- ${kind}: ${n}`)
  .join("\n")}

## Errors (${errors.length})

${table(errors)}
## Notes to glance at (${notes.length})

${table(notes)}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const countries = (JSON.parse(readFileSync("data/countries.json", "utf8")) as CountriesFile)
    .countries;
  const { pieces, findings, counts } = factCheck(countries);
  const path = process.argv.includes("--report")
    ? (process.argv[process.argv.indexOf("--report") + 1] ?? "content/FACT-CHECK.md")
    : "content/FACT-CHECK.md";
  writeFileSync(path, report(pieces, findings, counts));
  const errors = findings.filter((f) => f.level === "error");
  console.log(
    `Checked ${pieces} pieces: ${errors.length} errors, ${findings.length - errors.length} notes. Report: ${path}`,
  );
  for (const f of errors) console.log(`  ${f.kind}: ${f.where} (${f.locale}): ${f.problem}`);
  if (errors.length > 0) process.exitCode = 1;
}
