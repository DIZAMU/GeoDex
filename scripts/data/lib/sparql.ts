export type Binding = Record<string, { value: string; "xml:lang"?: string }>;

export function bindings(json: string): Binding[] {
  return (JSON.parse(json) as { results: { bindings: Binding[] } }).results.bindings;
}

/** "http://www.wikidata.org/entity/Q20" -> "Q20" */
export function qid(binding: Binding, key: string): string | undefined {
  return binding[key]?.value.split("/").pop();
}

export function val(binding: Binding, key: string): string | undefined {
  return binding[key]?.value;
}

export type Rank = "preferred" | "normal" | "deprecated";

export function rank(binding: Binding): Rank {
  const value = binding.rank?.value ?? "";
  if (value.endsWith("PreferredRank")) return "preferred";
  if (value.endsWith("DeprecatedRank")) return "deprecated";
  return "normal";
}

export function year(binding: Binding, key: string): number | undefined {
  const value = binding[key]?.value;
  return value ? Number.parseInt(value.slice(0, value.indexOf("-", 1)), 10) : undefined;
}

/** "Point(10.75 59.91)" -> [lon, lat] */
export function point(text: string): [number, number] {
  const match = text.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);
  if (!match) throw new Error(`Not a WKT point: ${text}`);
  return [Number(match[1]), Number(match[2])];
}

/**
 * Picks the statement to use from several: preferred rank over normal, deprecated never,
 * then the latest time, then the larger value, so the choice is deterministic.
 */
export function pickStatement<T extends { rank: Rank; time?: number; amount: number }>(
  statements: T[],
): T | undefined {
  const usable = statements.filter((s) => s.rank !== "deprecated");
  const preferred = usable.filter((s) => s.rank === "preferred");
  const pool = preferred.length > 0 ? preferred : usable;
  return [...pool].sort((a, b) => (b.time ?? 0) - (a.time ?? 0) || b.amount - a.amount)[0];
}
