import { useMemo } from "react";
import type { ContentIndex } from "@/data/content";
import type { WorldData } from "@/data/world";
import { confusionsFor } from "@/engine/confusions";
import type { Locale } from "@/i18n/locales";
import { buildIndexes, countryFacts, type StudyContext } from "./questions";

/** The question-building context for a world, locale and current confusion scores. */
export function useStudyContext(
  world: WorldData | null,
  locale: Locale,
  scores: Map<string, number>,
  content?: ContentIndex | null,
): StudyContext | null {
  const base = useMemo(
    () =>
      world
        ? {
            facts: countryFacts(world, world.excludeAsDistractor),
            indexes: buildIndexes(world, world.languageNames),
          }
        : null,
    [world],
  );
  return useMemo(() => {
    if (!world || !base) return null;
    return {
      world,
      locale,
      facts: base.facts,
      indexes: base.indexes,
      confusionsFor: (id: string) => confusionsFor(id, scores),
      curatedFor: (id: string, dimension: "name" | "flag" | "capital") =>
        world.confusionPairs
          .filter((p) => p.dimension === dimension && (p.a === id || p.b === id))
          .map((p) => (p.a === id ? p.b : p.a)),
      contrastKind: (a: string, b: string) => {
        const c = content?.confusion(a, b);
        if (!c) return null;
        return c.dimension === "flag" ? ("flag" as const) : ("place" as const);
      },
    };
  }, [world, base, locale, scores, content]);
}
