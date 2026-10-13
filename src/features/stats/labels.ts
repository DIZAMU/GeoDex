import type { TFunction } from "i18next";
import type { WorldData } from "@/data/world";
import type { Achievement } from "@/engine/achievements";
import type { Locale } from "@/i18n/locales";
import { nameOf } from "../session/parts";

/** Display text for an achievement in the active locale. */
export function achievementLabel(
  a: Achievement,
  world: WorldData,
  locale: Locale,
  t: TFunction,
): string {
  switch (a.kind) {
    case "region":
      return t("achievement.region", {
        skill: t(`skill.${a.skill}`),
        name: world.subregions.find((s) => s.id === a.subregion)?.names[locale] ?? a.subregion,
      });
    case "continent":
      return t("achievement.continent", {
        skill: t(`skill.${a.skill}`),
        name: t(`continent.${a.continent}` as "continent.africa"),
      });
    case "world":
      return t("achievement.world", { skill: t(`skill.${a.skill}`) });
    case "untangled": {
      const [x = "", y = ""] = a.pair.split("|");
      return t("achievement.untangled", {
        a: nameOf(world, x, locale),
        b: nameOf(world, y, locale),
      });
    }
    case "streak":
      return t("achievement.streak", { count: a.days });
  }
}
