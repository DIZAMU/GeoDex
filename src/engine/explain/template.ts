/**
 * Template syntax (PLAN.md 7.3): parsing, the `when` grammar and rendering. Hand-written,
 * no eval. Used by the compiler at build time and by the renderer at runtime.
 */
import { type CardType, COUNTRY_CARD_TYPES } from "../types.ts";
import {
  MOMENTS,
  type Moment,
  type Template,
  type Token,
  type WhenClause,
  type WhenOp,
} from "./types.ts";

export class TemplateError extends Error {}

const PATH = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)*$/;

/** Parses a body into text, `{path}` slots and `{?path:...}` optional segments. */
export function parseBody(source: string): Token[] {
  const [tokens, end] = parseTokens(source, 0, false);
  if (end !== source.length) throw new TemplateError(`Unmatched "}" at ${end}`);
  return tokens;
}

function parseTokens(source: string, start: number, nested: boolean): [Token[], number] {
  const tokens: Token[] = [];
  let text = "";
  let i = start;
  const flush = () => {
    if (text) tokens.push({ kind: "text", text });
    text = "";
  };
  while (i < source.length) {
    const ch = source[i];
    if (ch === "}") {
      if (!nested) throw new TemplateError(`Unmatched "}" at ${i}`);
      flush();
      return [tokens, i];
    }
    if (ch !== "{") {
      text += ch;
      i += 1;
      continue;
    }
    flush();
    if (source[i + 1] === "?") {
      const colon = source.indexOf(":", i);
      if (colon < 0) throw new TemplateError(`Optional segment without ":" at ${i}`);
      const path = source.slice(i + 2, colon).trim();
      if (!PATH.test(path)) throw new TemplateError(`Bad slot path "${path}"`);
      const [body, end] = parseTokens(source, colon + 1, true);
      if (source[end] !== "}") throw new TemplateError(`Unclosed optional segment at ${i}`);
      tokens.push({ kind: "optional", path, body });
      i = end + 1;
    } else {
      const close = source.indexOf("}", i);
      if (close < 0) throw new TemplateError(`Unclosed slot at ${i}`);
      const path = source.slice(i + 1, close).trim();
      if (!PATH.test(path)) throw new TemplateError(`Bad slot path "${path}"`);
      tokens.push({ kind: "slot", path });
      i = close + 1;
    }
  }
  if (nested) throw new TemplateError("Unclosed optional segment");
  flush();
  return [tokens, i];
}

/** Every slot path a body reads, required or optional. */
export function slotPaths(tokens: readonly Token[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    if (t.kind === "slot") out.push(t.path);
    if (t.kind === "optional") out.push(t.path, ...slotPaths(t.body));
  }
  return out;
}

const OPS: readonly WhenOp[] = [">=", "<=", "==", "!=", ">", "<"];

/** `path op literal` clauses joined by `and`. Literals: numbers, true/false, quoted or bare words. */
export function parseWhen(source: string): WhenClause[] {
  const trimmed = source.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+and\s+/).map((clause) => {
    const op = OPS.find((o) => clause.includes(o));
    if (!op) throw new TemplateError(`No operator in "${clause}"`);
    const at = clause.indexOf(op);
    const path = clause.slice(0, at).trim();
    const raw = clause.slice(at + op.length).trim();
    if (!PATH.test(path)) throw new TemplateError(`Bad path in "${clause}"`);
    if (!raw) throw new TemplateError(`No value in "${clause}"`);
    return { path, op, value: literal(raw) };
  });
}

function literal(raw: string): string | number | boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const quoted = raw.match(/^(["'])(.*)\1$/);
  if (quoted) return quoted[2] ?? "";
  if (/^[\w.-]+$/.test(raw)) return raw;
  throw new TemplateError(`Bad literal "${raw}"`);
}

export type SlotValue = string | number | boolean | null | undefined;
export type Slots = Readonly<Record<string, SlotValue>>;

function present(value: SlotValue): boolean {
  return value !== undefined && value !== null && value !== "" && value !== false;
}

export function evalWhen(clauses: readonly WhenClause[], slots: Slots): boolean {
  return clauses.every(({ path, op, value }) => {
    const actual = slots[path];
    if (actual === undefined || actual === null) return false;
    switch (op) {
      case "==":
        return actual === value;
      case "!=":
        return actual !== value;
      case ">":
        return typeof actual === "number" && typeof value === "number" && actual > value;
      case "<":
        return typeof actual === "number" && typeof value === "number" && actual < value;
      case ">=":
        return typeof actual === "number" && typeof value === "number" && actual >= value;
      case "<=":
        return typeof actual === "number" && typeof value === "number" && actual <= value;
      default:
        return false;
    }
  });
}

/** Renders a body. Null when a required slot has no value. */
export function render(tokens: readonly Token[], slots: Slots): string | null {
  let out = "";
  for (const t of tokens) {
    if (t.kind === "text") out += t.text;
    else if (t.kind === "slot") {
      const value = slots[t.path];
      if (!present(value)) return null;
      out += String(value);
    } else if (present(slots[t.path])) {
      out += render(t.body, slots) ?? "";
    }
  }
  return out;
}

/** Whether a template can be shown with these slots: requires, when, and every required slot. */
export function eligible(template: Template, slots: Slots): boolean {
  return (
    template.requires.every((r) => present(slots[r])) &&
    evalWhen(template.when, slots) &&
    render(template.body, slots) !== null
  );
}

function list(value: string): string[] {
  const inner = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  return inner
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parses one template file: frontmatter blocks between `---` lines, each followed by its
 * body. `cardTypes` defaults to every country card type.
 */
export function parseTemplateFile(source: string, file = "template"): Template[] {
  const chunks = source.replace(/\r\n/g, "\n").split(/^---$/m);
  if ((chunks.shift() ?? "").trim() !== "")
    throw new TemplateError(`${file}: text before the first "---"`);
  if (chunks.length % 2 !== 0) throw new TemplateError(`${file}: frontmatter without a body`);
  const templates: Template[] = [];
  for (let i = 0; i < chunks.length; i += 2) {
    const meta: Record<string, string> = {};
    for (const line of (chunks[i] ?? "").split("\n")) {
      if (!line.trim()) continue;
      const colon = line.indexOf(":");
      if (colon < 0) throw new TemplateError(`${file}: bad frontmatter line "${line}"`);
      meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
    const id = meta.id;
    if (!id) throw new TemplateError(`${file}: template without id`);
    const moment = meta.moment as Moment;
    if (!MOMENTS.includes(moment))
      throw new TemplateError(`${id}: unknown moment "${meta.moment}"`);
    const cardTypes = meta.cardTypes ? list(meta.cardTypes) : [...COUNTRY_CARD_TYPES];
    for (const type of cardTypes) {
      if (!(COUNTRY_CARD_TYPES as readonly string[]).includes(type) && type !== "contrast")
        throw new TemplateError(`${id}: unknown card type "${type}"`);
    }
    const body = (chunks[i + 1] ?? "").trim();
    if (!body) throw new TemplateError(`${id}: empty body`);
    try {
      templates.push({
        id,
        moment,
        cardTypes: cardTypes as CardType[],
        requires: meta.requires ? list(meta.requires) : [],
        when: parseWhen(meta.when ?? ""),
        body: parseBody(body),
      });
    } catch (error) {
      throw new TemplateError(`${id}: ${(error as Error).message}`);
    }
  }
  return templates;
}
