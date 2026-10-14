/** What GeoDex teaches, with counts from the data, for the welcome page (PLAN.md 11.1). */
import {
  Building2Icon,
  CoinsIcon,
  FlagIcon,
  GlobeIcon,
  HourglassIcon,
  LandmarkIcon,
  LayersIcon,
  type LucideIcon,
  MapPinIcon,
  MountainIcon,
} from "lucide-react";
import type { WorldData } from "@/data/world";
import { groupCardTypes } from "@/engine/groups";
import {
  CITY_CARD_TYPES,
  COUNTRY_CARD_TYPES,
  LANDMARK_CARD_TYPES,
  PHYSICAL_CARD_TYPES,
} from "@/engine/types";
import { historyCardTypes } from "../study/plan";

export type TopicId =
  | "countries"
  | "capitals"
  | "flags"
  | "currency"
  | "cities"
  | "groups"
  | "landmarks"
  | "physical"
  | "history";

export type Topic = { id: TopicId; icon: LucideIcon; count: number; optional: boolean };

/** Countries the default scope studies: UN members and observers. */
function coreCountries(world: WorldData) {
  return world.countries.filter((c) => c.status === "un_member" || c.status === "un_observer");
}

export function topics(world: WorldData): Topic[] {
  const countries = coreCountries(world).length;
  return [
    { id: "countries", icon: GlobeIcon, count: countries, optional: false },
    { id: "capitals", icon: MapPinIcon, count: countries, optional: false },
    { id: "flags", icon: FlagIcon, count: countries, optional: false },
    { id: "currency", icon: CoinsIcon, count: countries, optional: false },
    { id: "cities", icon: Building2Icon, count: world.cities.length, optional: true },
    { id: "groups", icon: LayersIcon, count: world.groups.length, optional: true },
    { id: "landmarks", icon: LandmarkIcon, count: world.landmarks.length, optional: true },
    { id: "physical", icon: MountainIcon, count: world.physical.length, optional: true },
    { id: "history", icon: HourglassIcon, count: world.history.length, optional: true },
  ];
}

/** Cards in the default course (countries only) and with every module on. */
export function cardCounts(world: WorldData): { core: number; all: number } {
  const core = coreCountries(world).length * COUNTRY_CARD_TYPES.length;
  const inWorld = (id: string) => world.byId.has(id);
  const extras =
    world.cities.length * CITY_CARD_TYPES.length +
    world.groups.reduce((n, g) => n + groupCardTypes(g.members.length).length, 0) +
    world.landmarks.length * LANDMARK_CARD_TYPES.length +
    world.physical.length * PHYSICAL_CARD_TYPES.length +
    world.history.reduce((n, e) => n + historyCardTypes(e, inWorld).length, 0);
  return { core, all: core + extras };
}
