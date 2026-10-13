/** Country card generation and stage unlocking (PLAN.md 5.3). */
import { type CardState, stabilityAtLeast } from "./scheduler";
import { type CardId, type CountryCardType, cardId } from "./types";

export const COUNTRY_STAGES: readonly (readonly [CountryCardType, CountryCardType])[] = [
  ["map_to_name", "name_to_map"],
  ["country_to_capital", "capital_to_country"],
  ["flag_to_name", "name_to_flag"],
  ["country_to_currency", "country_to_language"],
];

/** Both cards of a stage need this stability (days) before the next stage unlocks. */
export const UNLOCK_STABILITY_DAYS = 4;

export type CardOptions = {
  /** Stage 4 (currency and language) is optional. */
  currencyAndLanguage: boolean;
};

function stageCount(options: CardOptions): number {
  return options.currencyAndLanguage ? 4 : 3;
}

export function allCountryCards(entityId: string, options: CardOptions): CardId[] {
  return COUNTRY_STAGES.slice(0, stageCount(options)).flatMap((stage) =>
    stage.map((type) => cardId(entityId, type)),
  );
}

/** Whether the entity has started: any stage 1 card has a scheduled review. */
export function isIntroduced(entityId: string, states: ReadonlyMap<CardId, CardState>): boolean {
  return (COUNTRY_STAGES[0] ?? []).some((type) => states.has(cardId(entityId, type)));
}

/**
 * Cards of this entity that are unlocked but have never been reviewed. For an entity not
 * yet introduced, that is its stage 1 pair. Later stages unlock when both cards of the
 * previous stage reach review state with stability of at least 4 days.
 */
export function unlockedNewCards(
  entityId: string,
  states: ReadonlyMap<CardId, CardState>,
  options: CardOptions,
): CardId[] {
  const result: CardId[] = [];
  const stages = COUNTRY_STAGES.slice(0, stageCount(options));
  for (let index = 0; index < stages.length; index++) {
    const stage = stages[index] ?? [];
    const ids = stage.map((type) => cardId(entityId, type));
    if (index > 0) {
      const previous = (stages[index - 1] ?? []).map((type) => cardId(entityId, type));
      const unlocked = previous.every((id) =>
        stabilityAtLeast(states.get(id), UNLOCK_STABILITY_DAYS),
      );
      if (!unlocked) break;
    }
    result.push(...ids.filter((id) => !states.has(id)));
  }
  return result;
}

/** Stage number (1 to 4) of a country card type. */
export function stageOf(type: CountryCardType): number {
  return COUNTRY_STAGES.findIndex((stage) => stage.includes(type)) + 1;
}
