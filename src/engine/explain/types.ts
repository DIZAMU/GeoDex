/**
 * Content and template types for the explanation engine (PLAN.md 5.2, 7). Plain data.
 * Files in this folder import each other with explicit `.ts` extensions so the content
 * scripts can run them directly under Node.
 */
import type { CardType } from "../types.ts";

export type Locale = "en" | "nb";
export type L10n = Record<Locale, string>;

export const HOOK_TYPES = [
  "anchor",
  "shape",
  "etymology",
  "sound",
  "story",
  "flag_decode",
  "contrast",
] as const;
export type HookType = (typeof HOOK_TYPES)[number];

/** Hook types that work without wordplay or imagery (VOICE.md: at least one per entity). */
export const PLAIN_HOOK_TYPES: readonly HookType[] = ["anchor", "etymology", "contrast"];

export type Hook = { id: string; type: HookType; text: string; cardTypes?: CardType[] };
export type Fact = {
  id: string;
  text: L10n;
  tier: 1 | 2 | 3;
  sourceUrl?: string;
  verified: boolean;
};

export type EntityContent = {
  entityId: string;
  hooks: Record<Locale, Hook[]>;
  capitalHooks?: Record<Locale, Hook[]>;
  flagNote?: L10n;
  facts: Fact[];
};

/** content/entities/<module>/<group>.json */
export type ContentGroupFile = { group: string; entities: EntityContent[] };

export type ConfusionDimension = "name" | "flag" | "capital" | "location" | "not_capital";
export type Confusion = { a: string; b: string; dimension: ConfusionDimension; contrast: L10n };

export const MOMENTS = [
  "introduce",
  "correct",
  "correct_hard",
  "wrong",
  "lapse",
  "leech",
  "mastered",
] as const;
export type Moment = (typeof MOMENTS)[number];

/** A parsed template body: text with required slots and optional segments. */
export type Token =
  | { kind: "text"; text: string }
  | { kind: "slot"; path: string }
  | { kind: "optional"; path: string; body: Token[] };

export type WhenOp = "==" | "!=" | ">" | "<" | ">=" | "<=";
export type WhenClause = { path: string; op: WhenOp; value: string | number | boolean };

export type Template = {
  id: string;
  moment: Moment;
  cardTypes: CardType[];
  requires: string[];
  when: WhenClause[];
  body: Token[];
};

/** src/generated/templates.json */
export type TemplatesFile = Record<Locale, Template[]>;
