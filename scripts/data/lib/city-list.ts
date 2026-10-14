/** The city QIDs to build: the curated list plus every city mistaken for a capital. */
export function cityIds(curatedJson: string, confusionsJson: string): string[] {
  const curated = JSON.parse(curatedJson) as { cities: string[] };
  const confusions = JSON.parse(confusionsJson) as {
    confusions: { a: string; dimension: string }[];
  };
  const mistaken = confusions.confusions
    .filter((c) => c.dimension === "not_capital")
    .map((c) => c.a);
  return [...new Set([...curated.cities, ...mistaken])].sort();
}
