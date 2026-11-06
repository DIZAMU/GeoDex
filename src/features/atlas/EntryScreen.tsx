import { ArrowLeftIcon, DumbbellIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router";
import type { Country } from "@/data/types";
import { haversineKm } from "@/engine/geo";
import {
  type CardType,
  CITY_CARD_TYPES,
  COUNTRY_CARD_TYPES,
  cardId,
  LANDMARK_CARD_TYPES,
  PHYSICAL_CARD_TYPES,
  parseCardId,
} from "@/engine/types";
import { isLocale, type Locale } from "@/i18n/locales";
import { WorldMap } from "@/map/WorldMap";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { Meter } from "@/ui/meter";
import { Flag, nameOf } from "../session/parts";
import { useLevels } from "../study/levels";
import { historyCardTypes, scopedCountries } from "../study/plan";
import { cardLevel } from "../study/progress";
import { type Learner, useLearner } from "../study/useLearner";

/** Reviews shown in the history strip, newest last. */
const HISTORY = 40;
/** Neighbours farther than this, centre to centre, stay out of the country page's map frame. */
const NEARBY_KM = 5000;

export function EntryScreen() {
  const learner = useLearner();
  const { id = "" } = useParams();
  if (!learner) return <Loader />;
  const country = learner.world.byId.get(id);
  if (!country) return <Navigate to="/atlas" replace />;
  return <Entry learner={learner} country={country} />;
}

function Entry({ learner, country }: { learner: Learner; country: Country }) {
  const { t, i18n } = useTranslation();
  const locale: Locale = isLocale(i18n.language) ? i18n.language : "en";
  const other: Locale = locale === "en" ? "nb" : "en";
  const countries = useMemo(
    () => scopedCountries(learner.world, learner.settings),
    [learner.world, learner.settings],
  );
  const labelFor = useCallback(
    (id: string) => nameOf(learner.world, id, locale),
    [learner.world, locale],
  );
  const level = useLevels(learner).country(country.id);
  // Neighbours across an ocean (France and Brazil, through French Guiana) would frame half
  // the world; the map frames only those close to the country itself.
  const nearby = useMemo(
    () =>
      country.neighbors.filter((id) => {
        const n = learner.world.byId.get(id);
        return (
          n !== undefined &&
          haversineKm(country.centroid[0], country.centroid[1], n.centroid[0], n.centroid[1]) <
            NEARBY_KM
        );
      }),
    [country, learner.world],
  );
  const events = useMemo(
    () =>
      learner.events
        .filter((e) => parseCardId(e.cardId).entityId === country.id && e.mode !== "placement")
        .sort((a, b) => a.reviewedAt - b.reviewedAt),
    [learner.events, country.id],
  );
  const facts = useMemo(() => {
    const seen = new Set(
      events.flatMap((e) => e.snippetIds.filter((s) => s.startsWith("f:")).map((s) => s.slice(2))),
    );
    return (learner.content.byEntity.get(country.id)?.facts ?? []).filter((f) => seen.has(f.id));
  }, [events, learner.content, country.id]);
  const region = learner.world.subregions.find((s) => s.id === country.subregion);
  const cities = learner.world.cities.filter((c) => c.countryId === country.id);
  const landmarks = learner.world.landmarks.filter((l) => l.countryId === country.id);
  const physical = learner.world.physical.filter((f) => f.countries.includes(country.id));
  const past = learner.world.history.filter((e) => e.countries.includes(country.id));
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const number = new Intl.NumberFormat(locale);
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const recent = events.slice(-HISTORY);
  const correct = recent.filter((e) => e.correct).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-10 lg:py-8">
      <Link
        to="/atlas"
        viewTransition
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg pr-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("entry.back")}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="enter flex flex-col gap-6" aria-labelledby="entry-title">
          <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
            <Flag
              iso2={country.iso2}
              alt={t("flag.of", { name: country.names[locale] })}
              className="w-20 shrink-0 sm:w-28"
            />
            <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
              <h1 id="entry-title" className="text-3xl font-medium tracking-tight">
                {country.names[locale]}
              </h1>
              {country.names[other] !== country.names[locale] ? (
                <p className="text-muted-foreground" lang={other}>
                  {country.names[other]}
                </p>
              ) : null}
              {region ? (
                <p className="text-sm text-muted-foreground">{region.names[locale]}</p>
              ) : null}
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:ml-auto sm:w-36">
              <p className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{t("overview.memory")}</span>
                <span className="font-medium tabular-nums">{number.format(level.level)}</span>
              </p>
              <Meter
                value={level.share}
                label={t("overview.levelLabel", { level: level.level })}
                testId="entry-level"
              />
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-3 border-y border-border py-4 sm:grid-cols-2">
            <Fact
              label={country.capitals.length > 1 ? t("feedback.capitals") : t("feedback.capital")}
              value={list.format(
                country.capitals.map((c) => {
                  const roles = c.roles.filter((r) => r !== "primary");
                  return roles.length
                    ? `${c.names[locale]} (${roles.map((r) => t(`role.${r}`)).join(", ")})`
                    : c.names[locale];
                }),
              )}
            />
            <Fact
              label={t("feedback.currency")}
              value={list.format(country.currencies.map((c) => c.names[locale]))}
            />
            <Fact
              label={t("feedback.languages")}
              value={
                country.officialLanguages.length
                  ? list.format(country.officialLanguages.map((l) => l.names[locale]))
                  : t("entry.none")
              }
            />
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">{t("entry.neighbors")}</dt>
              <dd className="flex flex-wrap gap-x-2 gap-y-1">
                {country.neighbors.length === 0 ? t("entry.none") : null}
                {country.neighbors.map((n) =>
                  learner.world.byId.has(n) ? (
                    <Link
                      key={n}
                      to={`/atlas/${n}`}
                      viewTransition
                      className="underline decoration-border underline-offset-4 hover:decoration-foreground"
                    >
                      {labelFor(n)}
                    </Link>
                  ) : null,
                )}
              </dd>
            </div>
          </dl>

          <section aria-labelledby="cards-title" className="flex flex-col gap-3">
            <h2 id="cards-title" className="text-lg font-medium">
              {t("entry.cards")}
            </h2>
            <ul className="divide-y divide-border border-y border-border" data-testid="entry-cards">
              {COUNTRY_CARD_TYPES.map((type) => {
                const state = learner.states.get(cardId(country.id, type));
                const level = cardLevel(state);
                return (
                  // On a phone the status goes under the card's name: side by side, a long
                  // status squeezes the name to a word per line.
                  <li
                    key={type}
                    className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="size-3 shrink-0 rounded-sm border border-border"
                        style={{ background: `var(--mastery-${level})` }}
                      />
                      {t(`cardType.${type}`)}
                    </span>
                    <span className="pl-6 text-sm text-muted-foreground sm:pl-0 sm:text-right">
                      {t(`level.${level}`)}
                      {state && state.phase !== "new" ? (
                        <>
                          {", "}
                          {t("entry.due", { date: date.format(state.due) })}
                          {state.phase === "review"
                            ? `, ${t("entry.holds", { days: number.format(Math.round(state.stability)) })}`
                            : null}
                        </>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </section>

        <aside className="enter flex flex-col gap-6">
          <div className="surface aspect-[4/3] overflow-hidden">
            <WorldMap
              countries={countries}
              topology={learner.world.topology}
              focus={{ kind: "countries", ids: [country.id, ...nearby] }}
              highlight={{ target: country.id, labels: [country.id] }}
              labelFor={labelFor}
              ariaLabel={t("map.label")}
              padding={0.25}
              interactive={false}
            />
          </div>

          <section aria-labelledby="history-title" className="flex flex-col gap-3">
            <h2 id="history-title" className="text-lg font-medium">
              {t("entry.history")}
            </h2>
            {recent.length === 0 ? (
              <p className="text-muted-foreground">{t("entry.noHistory")}</p>
            ) : (
              <figure className="flex flex-col gap-2" data-testid="entry-history">
                {/* Correct is a tall bar, wrong a short one: height carries the meaning, not color. */}
                <div className="flex h-10 items-end gap-0.5" aria-hidden>
                  {recent.map((e) => (
                    <span
                      key={e.id}
                      className={
                        e.correct
                          ? "h-full flex-1 rounded-sm bg-foreground"
                          : "h-1/4 flex-1 rounded-sm bg-muted-foreground/60"
                      }
                    />
                  ))}
                </div>
                <figcaption className="text-sm text-muted-foreground">
                  {t("entry.correct")}: {number.format(correct)}, {t("entry.wrong")}:{" "}
                  {number.format(recent.length - correct)}
                </figcaption>
              </figure>
            )}
          </section>

          <ModuleList
            id="cities"
            title={t("entry.cities")}
            items={cities}
            types={CITY_CARD_TYPES}
            learner={learner}
            locale={locale}
          />
          <ModuleList
            id="landmarks"
            title={t("entry.landmarks")}
            items={landmarks}
            types={LANDMARK_CARD_TYPES}
            learner={learner}
            locale={locale}
          />
          <ModuleList
            id="physical"
            title={t("entry.physical")}
            items={physical}
            types={PHYSICAL_CARD_TYPES}
            learner={learner}
            locale={locale}
          />
          <ModuleList
            id="history"
            title={t("entry.pastNames")}
            items={past}
            types={(id) => {
              const e = learner.world.historyById.get(id);
              return e ? historyCardTypes(e, (c) => learner.world.byId.has(c)) : [];
            }}
            learner={learner}
            locale={locale}
          />

          <section aria-labelledby="facts-title" className="flex flex-col gap-3">
            <h2 id="facts-title" className="text-lg font-medium">
              {t("entry.facts")}
            </h2>
            {facts.length === 0 ? (
              <p className="text-muted-foreground">{t("entry.noFacts")}</p>
            ) : (
              <ul
                className="divide-y divide-border border-y border-border"
                data-testid="entry-facts"
              >
                {facts.map((f) => (
                  <li key={f.id} className="max-w-[62ch] py-3">
                    {f.text[locale]}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {region ? (
            <Button asChild variant="outline" size="lg" className="self-start">
              <Link to={`/drill?region=${region.id}`} viewTransition data-testid="entry-drill">
                <DumbbellIcon />
                {t("entry.drill", { region: region.names[locale] })}
              </Link>
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** A country's cities or landmarks with the learner's level for each (its weaker card). */
function ModuleList({
  id,
  title,
  items,
  types,
  learner,
  locale,
}: {
  id: string;
  title: string;
  items: readonly { id: string; names: { en: string; nb: string } }[];
  types: readonly CardType[] | ((id: string) => readonly CardType[]);
  learner: Learner;
  locale: "en" | "nb";
}) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h2 id={`${id}-title`} className="text-lg font-medium">
        {title}
      </h2>
      <ul className="divide-y divide-border border-y border-border" data-testid={`entry-${id}`}>
        {items.map((item) => {
          const level = Math.min(
            ...(typeof types === "function" ? types(item.id) : types).map((type) =>
              cardLevel(learner.states.get(cardId(item.id, type))),
            ),
          );
          return (
            <li key={item.id} className="flex items-center justify-between gap-4 py-2.5">
              <span className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-sm border border-border"
                  style={{ background: `var(--mastery-${level})` }}
                />
                {item.names[locale]}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {t(`level.${level as 0 | 1 | 2 | 3 | 4}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
