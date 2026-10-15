/**
 * Session picker (PLAN.md 11.2): a session of a chosen length, on everything due today or on
 * one skill, module or continent. The slice comes from today's plan, so a focused session
 * never adds work the plan did not schedule.
 */
import { arrange, type QueueItem } from "./session";
import { type CardType, parseCardId } from "./types";

export const SESSION_LENGTHS = [5, 10, 20] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];
export const DEFAULT_SESSION_LENGTH: SessionLength = 10;

export const SKILLS = ["location", "capitals", "flags", "currency_language"] as const;
export type Skill = (typeof SKILLS)[number];

export const FOCUS_MODULES = [
  "countries",
  "cities",
  "groups",
  "landmarks",
  "physical",
  "history",
] as const;
export type FocusModule = (typeof FOCUS_MODULES)[number];

export type Focus =
  | { kind: "mixed" }
  | { kind: "skill"; id: Skill }
  | { kind: "module"; id: FocusModule }
  /** A continent id or a UN M49 subregion code. */
  | { kind: "region"; id: string };

export const MIXED: Focus = { kind: "mixed" };

const MAP_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  "map_to_name",
  "name_to_map",
  "city_to_map",
  "landmark_to_map",
  "feature_to_map",
  "map_to_feature",
  "group_to_map",
  "map_to_group",
  "map_to_dissolved_state",
  "map_to_empire",
]);

/**
 * The skill a card trains: where a place is, capitals, flags, or currency and language. Other
 * cards (a landmark's photo, a city's country, a former name, contrast pairs) train none of
 * these and come up under their module, region or Mixed.
 */
export function cardSkill(type: CardType): Skill | null {
  if (MAP_TYPES.has(type)) return "location";
  if (type === "flag_to_name" || type === "name_to_flag") return "flags";
  if (type === "country_to_capital" || type === "capital_to_country") return "capitals";
  if (type === "country_to_currency" || type === "country_to_language") return "currency_language";
  return null;
}

export function cardModule(type: CardType): FocusModule {
  switch (type) {
    case "city_to_country":
    case "city_to_map":
      return "cities";
    case "group_to_map":
    case "map_to_group":
    case "group_member":
      return "groups";
    case "photo_to_name":
    case "landmark_to_country":
    case "landmark_to_map":
      return "landmarks";
    case "feature_to_map":
    case "map_to_feature":
      return "physical";
    case "former_name_to_country":
    case "map_to_dissolved_state":
    case "dissolved_state_member":
    case "map_to_empire":
    case "empire_to_era":
      return "history";
    default:
      return "countries";
  }
}

/** A region focus is a continent or one of its subregions. `continentOf` maps a queue item's subregion to its continent id. */
export function matchesFocus(
  item: QueueItem,
  focus: Focus,
  continentOf: (subregion: string) => string | undefined,
): boolean {
  const { type } = parseCardId(item.cardId);
  switch (focus.kind) {
    case "mixed":
      return true;
    case "skill":
      return cardSkill(type) === focus.id;
    case "module":
      return cardModule(type) === focus.id;
    case "region":
      return item.subregion === focus.id || continentOf(item.subregion) === focus.id;
  }
}

/** Text form for URLs and settings: "mixed", "skill:flags", "module:cities", "region:asia". */
export function focusKey(focus: Focus): string {
  return focus.kind === "mixed" ? "mixed" : `${focus.kind}:${focus.id}`;
}

export function parseFocus(key: string | null | undefined): Focus {
  const [kind, id = ""] = (key ?? "").split(":");
  if (kind === "skill" && (SKILLS as readonly string[]).includes(id))
    return { kind, id: id as Skill };
  if (kind === "module" && (FOCUS_MODULES as readonly string[]).includes(id))
    return { kind, id: id as FocusModule };
  // A continent id ("south_america") or a UN M49 subregion code ("154").
  if (kind === "region" && /^([a-z_]+|\d{3})$/.test(id)) return { kind, id };
  return MIXED;
}

export function parseLength(value: string | number | null | undefined): SessionLength {
  const n = Number(value);
  return (SESSION_LENGTHS as readonly number[]).includes(n)
    ? (n as SessionLength)
    : DEFAULT_SESSION_LENGTH;
}

export type SessionSlice = {
  /** The session's questions, due cards first, arranged so no entity repeats back to back. */
  queue: QueueItem[];
  /** Cards today's plan holds in this focus. */
  available: number;
  /** Due reviews today's plan holds outside this focus. */
  dueOutside: number;
};

/** Takes up to `length` cards in the focus from today's queue: due reviews, then new cards. */
export function sliceSession(
  plan: readonly QueueItem[],
  focus: Focus,
  length: number,
  continentOf: (subregion: string) => string | undefined,
): SessionSlice {
  const inFocus = plan.filter((item) => matchesFocus(item, focus, continentOf));
  const due = inFocus.filter((item) => !item.isNew);
  const fresh = inFocus.filter((item) => item.isNew);
  const take = new Set([...due, ...fresh].slice(0, Math.max(0, length)));
  return {
    // The plan already spreads new cards among reviews; keep that order for the chosen ones.
    queue: arrange(plan.filter((item) => take.has(item))),
    available: inFocus.length,
    dueOutside: plan.filter((item) => !item.isNew && !matchesFocus(item, focus, continentOf))
      .length,
  };
}

/** How many cards each focus would get today, for the picker. */
export function focusCounts(
  plan: readonly QueueItem[],
  focuses: readonly Focus[],
  continentOf: (subregion: string) => string | undefined,
): Map<string, number> {
  return new Map(
    focuses.map((f) => [
      focusKey(f),
      plan.filter((item) => matchesFocus(item, f, continentOf)).length,
    ]),
  );
}
