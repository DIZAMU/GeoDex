/** Engine-level types. Plain data, no React or Dexie. */

export const COUNTRY_CARD_TYPES = [
  "map_to_name",
  "name_to_map",
  "country_to_capital",
  "capital_to_country",
  "flag_to_name",
  "name_to_flag",
  "country_to_currency",
  "country_to_language",
] as const;
export type CountryCardType = (typeof COUNTRY_CARD_TYPES)[number];
/** Cities: which country a city is in, and where it is (pin on the map). */
export const CITY_CARD_TYPES = ["city_to_country", "city_to_map"] as const;
export type CityCardType = (typeof CITY_CARD_TYPES)[number];
/**
 * Groups of countries (docs/DECISIONS.md 034): tap every member, name the highlighted group, and
 * pick the member among non-members.
 */
export const GROUP_CARD_TYPES = ["group_to_map", "map_to_group", "group_member"] as const;
export type GroupCardType = (typeof GROUP_CARD_TYPES)[number];
/** Landmarks: name from the photo, which country, and where (pin). */
export const LANDMARK_CARD_TYPES = [
  "photo_to_name",
  "landmark_to_country",
  "landmark_to_map",
] as const;
export type LandmarkCardType = (typeof LANDMARK_CARD_TYPES)[number];
/** Physical geography: tap the feature, and name the highlighted feature. */
export const PHYSICAL_CARD_TYPES = ["feature_to_map", "map_to_feature"] as const;
export type PhysicalCardType = (typeof PHYSICAL_CARD_TYPES)[number];
/**
 * History: a former name to today's country, name a dissolved state's or an
 * empire's outline, a member of a dissolved state, and when an empire existed.
 */
export const HISTORY_CARD_TYPES = [
  "former_name_to_country",
  "map_to_dissolved_state",
  "dissolved_state_member",
  "map_to_empire",
  "empire_to_era",
] as const;
export type HistoryCardType = (typeof HISTORY_CARD_TYPES)[number];
export type CardType =
  | CountryCardType
  | CityCardType
  | GroupCardType
  | LandmarkCardType
  | PhysicalCardType
  | HistoryCardType
  | "contrast";

/** `${entityId}:${cardType}`. Never changes once shipped. */
export type CardId = string;

/** 1 Again, 2 Hard, 3 Good, 4 Easy. */
export type Rating = 1 | 2 | 3 | 4;

/** How the answer was given. */
export type AnswerMode = "mc" | "typed" | "map" | "pin" | "placement";

/** The per-session input setting the learner chose. */
export type InputSetting = "auto" | "mc" | "typing";

/** The fields of a review event the engine reads. The stored event has more (see db). */
export type ReviewEventCore = {
  id: string;
  cardId: CardId;
  reviewedAt: number; // ms since epoch
  rating: Rating;
  mode: AnswerMode;
  correct: boolean;
  chosenAnswer: string | null;
  responseMs: number;
  /** False for drill and missed placement answers: they never touch scheduling. */
  scheduled: boolean;
};

export function cardId(entityId: string, type: CardType): CardId {
  return `${entityId}:${type}`;
}

export function parseCardId(id: CardId): { entityId: string; type: CardType } {
  const index = id.lastIndexOf(":");
  return { entityId: id.slice(0, index), type: id.slice(index + 1) as CardType };
}

export const DAY_MS = 86_400_000;
