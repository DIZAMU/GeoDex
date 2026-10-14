import { AwardIcon, DumbbellIcon, GlobeIcon, MapIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CONTINENTS } from "@/data/types";
import { SKILL_IDS, type Skill } from "@/engine/achievements";
import { isLocale } from "@/i18n/locales";
import { GlobeMap } from "@/map/GlobeMap";
import { WorldMap } from "@/map/WorldMap";
import { Loader } from "@/ui/loader";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import { nameOf } from "../session/parts";
import { scopedCountries } from "../study/plan";
import { useProgress } from "../study/progress";
import { type Learner, useLearner } from "../study/useLearner";

export const LEVELS = [0, 1, 2, 3, 4] as const;

export function isSkill(value: string | null): value is Skill {
  return value !== null && (SKILL_IDS as string[]).includes(value);
}

export function AtlasScreen() {
  const learner = useLearner();
  if (!learner) return <Loader />;
  return <Atlas learner={learner} />;
}

/** Mastery legend: the theme's luminance ramp with a text label per step. */
export function LevelLegend() {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {LEVELS.map((n) => (
        <li key={n} className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 rounded-sm border border-border"
            style={{ background: `var(--mastery-${n})` }}
          />
          {t(`level.${n}`)}
        </li>
      ))}
    </ul>
  );
}

function Atlas({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const raw = params.get("skill");
  const skill: Skill = isSkill(raw) ? raw : "location";
  const flat = params.get("view") === "flat";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const home = learner.settings.homeCountry
    ? learner.world.byId.get(learner.settings.homeCountry)
    : undefined;
  const progress = useProgress(learner);
  const countries = useMemo(
    () => scopedCountries(learner.world, learner.settings),
    [learner.world, learner.settings],
  );
  const levels = useMemo(() => progress.levels(skill), [progress, skill]);
  const selectable = useMemo(() => new Set(countries.map((c) => c.id)), [countries]);
  const earned = useMemo(
    () => new Set(progress.achievements.map((a) => a.id)),
    [progress.achievements],
  );
  const labelFor = useCallback(
    (id: string) => nameOf(learner.world, id, locale),
    [learner.world, locale],
  );
  const number = new Intl.NumberFormat(locale);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:px-10 lg:h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:py-8">
      <section aria-labelledby="atlas-title" className="enter flex min-h-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 id="atlas-title" className="font-name text-3xl tracking-tight">
            {t("atlas.title")}
          </h1>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={skill}
            aria-label={t("atlas.show")}
            className="grid w-full grid-cols-2 sm:flex sm:w-fit"
            onValueChange={(value) => {
              if (isSkill(value)) setParam("skill", value);
            }}
          >
            {SKILL_IDS.map((s) => (
              <ToggleGroupItem key={s} value={s} data-testid={`skill-${s}`}>
                {t(`skill.${s}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div
          className="surface aspect-[16/10] min-h-0 overflow-hidden lg:aspect-auto lg:flex-1"
          data-testid="atlas-map"
        >
          {flat ? (
            <WorldMap
              countries={countries}
              topology={learner.world.topology}
              focus={{ kind: "world" }}
              highlight={{ levels }}
              selectable={selectable}
              onSelect={(id) => navigate(`/atlas/${id}`, { viewTransition: true })}
              labelFor={labelFor}
              ariaLabel={t("map.label")}
            />
          ) : (
            <GlobeMap
              countries={countries}
              topology={learner.world.topology}
              levels={levels}
              selectable={selectable}
              onSelect={(id) => navigate(`/atlas/${id}`, { viewTransition: true })}
              labelFor={labelFor}
              ariaLabel={t("atlas.globeLabel")}
              initialCenter={home?.centroid}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="sr-only">{t("atlas.legend")}</p>
            <LevelLegend />
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            size="sm"
            value={flat ? "flat" : "globe"}
            aria-label={t("atlas.view")}
            onValueChange={(value) => {
              if (value) setParam("view", value === "flat" ? "flat" : null);
            }}
          >
            <ToggleGroupItem value="globe" data-testid="view-globe">
              <GlobeIcon aria-hidden />
              {t("atlas.globe")}
            </ToggleGroupItem>
            <ToggleGroupItem value="flat" data-testid="view-flat">
              <MapIcon aria-hidden />
              {t("atlas.flat")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </section>

      <section
        aria-labelledby="regions-title"
        className="enter flex min-h-0 flex-col gap-3"
        data-testid="atlas-regions"
      >
        <h2 id="regions-title" className="font-name text-lg">
          {t("atlas.regions")}
        </h2>
        <div className="surface min-h-0 flex-1 overflow-y-auto">
          {CONTINENTS.map((continent) => {
            const subs = learner.world.subregions.filter(
              (s) => s.continent === continent && countries.some((c) => c.subregion === s.id),
            );
            if (subs.length === 0) return null;
            return (
              <div key={continent} className="border-b border-border last:border-b-0">
                <h3 className="sticky top-0 bg-card/95 px-4 pt-3 pb-1 text-xs tracking-wide text-muted-foreground uppercase backdrop-blur">
                  {t(`continent.${continent}`)}
                </h3>
                <ul>
                  {subs.map((s) => {
                    const members = countries.filter((c) => c.subregion === s.id);
                    const mastered = members.filter((c) => levels.get(c.id) === 4).length;
                    const badge = earned.has(`region:${skill}:${s.id}`);
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 px-4 py-2"
                        data-testid={`region-${s.id}`}
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-1.5 truncate">
                            {s.names[locale]}
                            {badge ? (
                              <AwardIcon
                                className="size-4 shrink-0 text-primary"
                                aria-label={t("atlas.badge")}
                              />
                            ) : null}
                          </span>
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {t("atlas.mastered", {
                              n: number.format(mastered),
                              total: number.format(members.length),
                            })}
                          </span>
                          <MiniBar members={members.map((c) => levels.get(c.id) ?? 0)} />
                        </div>
                        <Link
                          to={`/drill?region=${s.id}`}
                          viewTransition
                          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`${t("atlas.drill")}: ${s.names[locale]}`}
                          title={t("atlas.drill")}
                        >
                          <DumbbellIcon className="size-4" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** One segment per country, sorted by level, so a region's spread reads at a glance. */
function MiniBar({ members }: { members: number[] }) {
  const sorted = [...members].sort((a, b) => b - a);
  return (
    <span
      aria-hidden
      className="mt-1 flex h-1.5 w-40 max-w-full gap-px overflow-hidden rounded-full"
    >
      {sorted.map((level, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: segments have no identity beyond position
          key={i}
          className="flex-1"
          style={{ background: `var(--mastery-${level})` }}
        />
      ))}
    </span>
  );
}
