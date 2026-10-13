/**
 * Builds the explanation for one answer from the learner's history (PLAN.md 7). Glue
 * between the app's data and the pure engine in src/engine/explain.
 */

import type { FSRS } from "ts-fsrs";
import type { ContentIndex } from "@/data/content";
import type { WorldData } from "@/data/world";
import {
  type Explanation,
  hookStats,
  momentFor,
  selectExplanation,
  snippetId,
} from "@/engine/explain/select";
import { buildSlots } from "@/engine/explain/slots";
import type { HookType, Locale, Moment } from "@/engine/explain/types";
import { applyReview, type CardPhase, type CardState } from "@/engine/scheduler";
import { type CardId, type CardType, parseCardId, type Rating } from "@/engine/types";

export type ExplainHistory = {
  events: readonly {
    cardId: string;
    reviewedAt: number;
    correct: boolean;
    scheduled: boolean;
    snippetIds: readonly string[];
  }[];
  votes: readonly { cardId: string; hookId: string }[];
  states: ReadonlyMap<CardId, CardState>;
};

/** The country a wrong pick points at: a country id, or the country of a picked capital. */
export function chosenCountryId(world: WorldData, chosenId: string | null): string | null {
  if (!chosenId) return null;
  if (world.byId.has(chosenId)) return chosenId;
  return world.countries.find((c) => c.capitals.some((cap) => cap.id === chosenId))?.id ?? null;
}

function maxStability(states: ReadonlyMap<CardId, CardState>): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of states.values()) {
    const { entityId } = parseCardId(s.cardId);
    if (s.phase !== "new") out.set(entityId, Math.max(out.get(entityId) ?? 0, s.stability));
  }
  return out;
}

export function explain(input: {
  world: WorldData;
  content: ContentIndex;
  history: ExplainHistory;
  locale: Locale;
  homeCountry: string | null;
  cardId: CardId;
  moment: Moment;
  chosenId?: string | null;
  /** Review count used for the seed. */
  reps: number;
}): Explanation {
  const { world, content, history, locale } = input;
  const { entityId, type } = parseCardId(input.cardId);
  if (type === "contrast") {
    // A contrast card's whole lesson is the contrast text for its pair.
    const [a = "", b = ""] = entityId.split("|");
    const c = content.confusion(a, b);
    const id = c ? `${c.a}|${c.b}` : "";
    return c
      ? {
          moment: input.moment,
          blocks: [{ kind: "contrast", id, text: c.contrast[locale] }],
          snippetIds: [snippetId.contrast(id)],
        }
      : { moment: input.moment, blocks: [], snippetIds: [] };
  }
  const target = world.byId.get(entityId);
  const chosen = chosenCountryId(world, input.chosenId ?? null);
  const cardEvents = history.events
    .filter((e) => e.cardId === input.cardId)
    .sort((a, b) => b.reviewedAt - a.reviewedAt);
  const lastHook = cardEvents.flatMap((e) => e.snippetIds).find((id) => id.startsWith("h:"));
  const lastHookType: HookType | null = lastHook
    ? (content.hookType(lastHook.slice(2)) ?? null)
    : null;
  const stability = maxStability(history.states);
  const subregions = new Map(world.subregions.map((s) => [s.id, s.names[locale]]));
  const slots = target
    ? buildSlots({
        locale,
        target,
        chosen: chosen ? world.byId.get(chosen) : null,
        home: input.homeCountry ? world.byId.get(input.homeCountry) : null,
        countryById: (id) => world.byId.get(id),
        subregionName: (id) => subregions.get(id) ?? "",
        stability: (id) => stability.get(id) ?? 0,
        timesSeen: cardEvents.length,
        lastHookType,
      })
    : {};
  const seenFacts = new Set(
    history.events
      .filter((e) => parseCardId(e.cardId).entityId === entityId)
      .flatMap((e) => e.snippetIds)
      .filter((id) => id.startsWith("f:")),
  );
  const confusion = chosen ? content.confusion(entityId, chosen) : undefined;
  return selectExplanation({
    locale,
    moment: input.moment,
    cardId: input.cardId,
    cardType: type as CardType,
    reps: input.reps,
    content: content.byEntity.get(entityId),
    templates: content.templates,
    slots,
    recent: cardEvents.map((e) => e.snippetIds),
    seenFacts,
    hidden: new Set(history.votes.filter((v) => v.cardId === input.cardId).map((v) => v.hookId)),
    stats: hookStats(history.events, history.votes, content.hookType),
    contrast: confusion
      ? { id: `${confusion.a}|${confusion.b}`, text: confusion.contrast[locale] }
      : null,
  });
}

/** The moment for an answer, previewing the card state the answer will produce. */
export function answerMoment(input: {
  scheduler: FSRS;
  before: CardState | undefined;
  cardId: CardId;
  correct: boolean;
  rating: Rating;
  now: number;
}): Moment {
  const after = applyReview(input.scheduler, input.before ?? null, {
    cardId: input.cardId,
    reviewedAt: input.now,
    rating: input.rating,
    scheduled: true,
    mode: "mc",
  });
  const phaseBefore: CardPhase | null = input.before?.phase ?? null;
  return momentFor({
    correct: input.correct,
    rating: input.rating,
    phaseBefore,
    lapsesAfter: after?.lapses ?? 0,
    stabilityAfter: after?.stability ?? 0,
  });
}
