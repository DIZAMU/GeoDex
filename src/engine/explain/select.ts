/**
 * Explanation selection (PLAN.md 7.2, 7.4, 6.8). Pure and seeded: the same card at the same
 * review count shows the same explanation on every device.
 */
import { createRng, type Rng, weightedPick } from "../random.ts";
import type { CardType, Rating } from "../types.ts";
import { eligible, render, type Slots } from "./template.ts";
import type {
  EntityContent,
  Fact,
  Hook,
  HookType,
  Locale,
  Moment,
  Template,
  TemplatesFile,
} from "./types.ts";

export const RECENT_VIEWS = 3;
export const MAX_WORDS = 60;
export const LEECH_LAPSES = 6;
export const MASTERED_STABILITY_DAYS = 60;

export type Block =
  | { kind: "template"; id: string; text: string }
  | { kind: "hook"; id: string; hookType: HookType; text: string; locale: Locale }
  | { kind: "fact"; id: string; tier: 1 | 2 | 3; text: string }
  | { kind: "contrast"; id: string; text: string };

export type Explanation = { moment: Moment; blocks: Block[]; snippetIds: string[] };

/** Snippet ids as stored on review events: one namespace per kind. */
export const snippetId = {
  template: (id: string) => `t:${id}`,
  hook: (id: string) => `h:${id}`,
  fact: (id: string) => `f:${id}`,
  contrast: (id: string) => `c:${id}`,
};

/** PLAN.md 7.2. `phaseBefore` is the card's phase before this answer. */
export function momentFor(input: {
  correct: boolean;
  rating: Rating;
  phaseBefore: "new" | "learning" | "review" | "relearning" | null;
  lapsesAfter: number;
  stabilityAfter: number;
}): Moment {
  if (!input.correct) {
    if (input.lapsesAfter >= LEECH_LAPSES) return "leech";
    if (input.phaseBefore === "review") return "lapse";
    return "wrong";
  }
  if (input.rating === 2) return "correct_hard";
  if (input.stabilityAfter >= MASTERED_STABILITY_DAYS) return "mastered";
  return "correct";
}

/** Beta(successes + 1, failures + 1) mean per hook type. */
export type HookStats = ReadonlyMap<HookType, { successes: number; failures: number }>;

export function hookWeight(stats: HookStats, type: HookType): number {
  const s = stats.get(type) ?? { successes: 0, failures: 0 };
  return (s.successes + 1) / (s.successes + s.failures + 2);
}

/**
 * Per hook type, whether the next review after a hook was shown succeeded. "Not helpful"
 * votes count as one failure each.
 */
export function hookStats(
  events: readonly {
    cardId: string;
    reviewedAt: number;
    correct: boolean;
    scheduled: boolean;
    snippetIds: readonly string[];
  }[],
  votes: readonly { hookId: string }[],
  typeOf: (hookId: string) => HookType | undefined,
): Map<HookType, { successes: number; failures: number }> {
  const stats = new Map<HookType, { successes: number; failures: number }>();
  const add = (type: HookType | undefined, success: boolean) => {
    if (!type) return;
    const s = stats.get(type) ?? { successes: 0, failures: 0 };
    if (success) s.successes += 1;
    else s.failures += 1;
    stats.set(type, s);
  };
  const byCard = new Map<string, typeof events>();
  for (const e of events) {
    if (!e.scheduled) continue;
    byCard.set(e.cardId, [...(byCard.get(e.cardId) ?? []), e]);
  }
  for (const list of byCard.values()) {
    const sorted = [...list].sort((a, b) => a.reviewedAt - b.reviewedAt);
    for (let i = 0; i < sorted.length - 1; i++) {
      const next = sorted[i + 1];
      for (const id of sorted[i]?.snippetIds ?? []) {
        if (id.startsWith("h:") && next) add(typeOf(id.slice(2)), next.correct);
      }
    }
  }
  for (const v of votes) add(typeOf(v.hookId), false);
  return stats;
}

export type SelectInput = {
  locale: Locale;
  moment: Moment;
  cardId: string;
  cardType: CardType;
  /** Review count of the card, for the seed. */
  reps: number;
  content: EntityContent | undefined;
  templates: TemplatesFile;
  slots: Slots;
  /** Snippet ids shown on this card's most recent views, newest first. */
  recent: readonly (readonly string[])[];
  /** Snippet ids ever shown on any card of this entity, to prefer unseen facts. */
  seenFacts: ReadonlySet<string>;
  /** Hook ids voted "Not helpful" for this card. */
  hidden: ReadonlySet<string>;
  stats: HookStats;
  /** Contrast text for the pair (target, chosen), when one exists. */
  contrast?: { id: string; text: string } | null;
};

const LOCATION: readonly CardType[] = ["map_to_name", "name_to_map"];
const CAPITAL: readonly CardType[] = ["country_to_capital", "capital_to_country"];
const FLAG: readonly CardType[] = ["flag_to_name", "name_to_flag"];

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Hooks for a card type, in the requested locale, falling back to English per entity. */
function hooksFor(content: EntityContent | undefined, cardType: CardType, locale: Locale) {
  if (!content) return [] as { hook: Hook; locale: Locale }[];
  const capital = CAPITAL.includes(cardType) && content.capitalHooks;
  const pick = (l: Locale) => (capital ? (content.capitalHooks?.[l] ?? []) : content.hooks[l]);
  const own = pick(locale);
  const source = own.length > 0 ? locale : "en";
  return (own.length > 0 ? own : pick("en"))
    .filter((h) => !h.cardTypes || h.cardTypes.includes(cardType))
    .filter((h) => !(LOCATION.includes(cardType) && h.type === "flag_decode"))
    .map((hook) => ({ hook, locale: source as Locale }));
}

function factsFor(content: EntityContent | undefined, cardType: CardType, locale: Locale) {
  if (!content) return [] as { id: string; tier: 1 | 2 | 3; text: string }[];
  const facts = content.facts.map((f: Fact) => ({ id: f.id, tier: f.tier, text: f.text[locale] }));
  if (FLAG.includes(cardType) && content.flagNote) {
    facts.unshift({ id: `${content.entityId}.flag`, tier: 1, text: content.flagNote[locale] });
  }
  return facts;
}

/** Drops recently shown candidates unless that would leave nothing. */
function fresh<T>(items: readonly T[], idOf: (item: T) => string, recent: ReadonlySet<string>) {
  const unseen = items.filter((i) => !recent.has(idOf(i)));
  return unseen.length > 0 ? unseen : [...items];
}

function pickTemplate(input: SelectInput, recent: ReadonlySet<string>, rng: Rng) {
  const pool = (input.templates[input.locale] ?? []).filter(
    (t: Template) =>
      t.moment === input.moment && t.cardTypes.includes(input.cardType) && eligible(t, input.slots),
  );
  if (pool.length === 0) return null;
  // Templates that use what is known about this answer (the wrong pick, home, conditions)
  // are more useful than the generic ones, so they are picked more often.
  const t = weightedPick(
    fresh(pool, (x) => snippetId.template(x.id), recent),
    (x) => 1 + 3 * x.requires.length + x.when.length,
    rng,
  );
  const text = render(t.body, input.slots);
  return text ? { kind: "template" as const, id: t.id, text } : null;
}

function pickHook(
  input: SelectInput,
  recent: ReadonlySet<string>,
  rng: Rng,
  filter: (type: HookType) => boolean = () => true,
) {
  const candidates = hooksFor(input.content, input.cardType, input.locale).filter(
    (c) => !input.hidden.has(c.hook.id) && filter(c.hook.type),
  );
  if (candidates.length === 0) return null;
  const pool = fresh(candidates, (c) => snippetId.hook(c.hook.id), recent);
  const flagBoost = (type: HookType) =>
    FLAG.includes(input.cardType) && type === "flag_decode" ? 3 : 1;
  const best =
    input.moment === "correct_hard"
      ? Math.max(...pool.map((c) => hookWeight(input.stats, c.hook.type)))
      : null;
  const c = weightedPick(
    pool,
    (x) =>
      best !== null && hookWeight(input.stats, x.hook.type) < best
        ? 0
        : hookWeight(input.stats, x.hook.type) * flagBoost(x.hook.type),
    rng,
  );
  return {
    kind: "hook" as const,
    id: c.hook.id,
    hookType: c.hook.type,
    text: c.hook.text,
    locale: c.locale,
  };
}

function pickFact(
  input: SelectInput,
  recent: ReadonlySet<string>,
  rng: Rng,
  tiers: readonly (1 | 2 | 3)[],
  lowestUnseen = false,
) {
  const all = factsFor(input.content, input.cardType, input.locale).filter((f) =>
    tiers.includes(f.tier),
  );
  if (all.length === 0) return null;
  let pool = fresh(all, (f) => snippetId.fact(f.id), recent);
  if (lowestUnseen) {
    const unseen = pool.filter((f) => !input.seenFacts.has(snippetId.fact(f.id)));
    if (unseen.length > 0) {
      const tier = Math.min(...unseen.map((f) => f.tier));
      pool = unseen.filter((f) => f.tier === tier);
    }
  }
  const f = weightedPick(pool, (x) => (input.seenFacts.has(snippetId.fact(x.id)) ? 1 : 3), rng);
  return { kind: "fact" as const, id: f.id, tier: f.tier, text: f.text };
}

export function selectExplanation(input: SelectInput): Explanation {
  const rng = createRng(`${input.cardId}#${input.reps}`);
  const recent = new Set(input.recent.slice(0, RECENT_VIEWS).flat());
  const blocks: Block[] = [];
  const push = (b: Block | null) => {
    if (b) blocks.push(b);
  };

  const template = pickTemplate(input, recent, rng);
  switch (input.moment) {
    case "introduce":
      push(template);
      push(pickHook(input, recent, rng, (t) => t === "anchor") ?? pickHook(input, recent, rng));
      push(pickFact(input, recent, rng, [1]));
      break;
    case "correct":
      push(template);
      push(pickFact(input, recent, rng, [1, 2, 3], true));
      break;
    case "correct_hard":
      push(template);
      push(pickHook(input, recent, rng));
      break;
    case "wrong":
      push(template);
      if (input.contrast) push({ kind: "contrast", ...input.contrast });
      push(pickHook(input, recent, rng));
      break;
    case "lapse": {
      const last = input.slots["user.lastHookType"];
      push(template);
      if (input.contrast) push({ kind: "contrast", ...input.contrast });
      push(pickHook(input, recent, rng, (t) => t !== last) ?? pickHook(input, recent, rng));
      break;
    }
    case "leech":
      // Every remaining hook (PLAN.md 6.9), so the word cap does not apply.
      push(template);
      if (input.contrast) push({ kind: "contrast", ...input.contrast });
      for (const c of hooksFor(input.content, input.cardType, input.locale)) {
        if (!input.hidden.has(c.hook.id))
          push({
            kind: "hook",
            id: c.hook.id,
            hookType: c.hook.type,
            text: c.hook.text,
            locale: c.locale,
          });
      }
      break;
    case "mastered":
      push(template);
      push(pickFact(input, recent, rng, [3]) ?? pickFact(input, recent, rng, [2, 3], true));
      break;
  }

  const kept = input.moment === "leech" ? blocks : capWords(blocks);
  return {
    moment: input.moment,
    blocks: kept,
    snippetIds: kept.map((b) => snippetId[b.kind](b.id)),
  };
}

/** At most MAX_WORDS: drops facts, then contrast, then hooks, keeping at least one block. */
function capWords(blocks: Block[]): Block[] {
  const order: Block["kind"][] = ["fact", "contrast", "hook", "template"];
  let kept = [...blocks];
  const total = () => kept.reduce((n, b) => n + words(b.text), 0);
  for (const kind of order) {
    if (total() <= MAX_WORDS || kept.length <= 1) break;
    const index = kept.findIndex((b) => b.kind === kind);
    if (index >= 0) kept = kept.filter((_, i) => i !== index);
  }
  return kept;
}
