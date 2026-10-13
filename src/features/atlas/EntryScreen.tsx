import { ArrowLeftIcon, DumbbellIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router";
import type { Country } from "@/data/types";
import { COUNTRY_CARD_TYPES, cardId, parseCardId } from "@/engine/types";
import { isLocale, type Locale } from "@/i18n/locales";
import { WorldMap } from "@/map/WorldMap";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { Flag, nameOf } from "../session/parts";
import { scopedCountries } from "../study/plan";
import { cardLevel } from "../study/progress";
import { type Learner, useLearner } from "../study/useLearner";

/** Reviews shown in the history strip, newest last. */
const HISTORY = 40;

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
          <div className="flex items-start gap-5">
            <Flag
              iso2={country.iso2}
              alt={t("flag.of", { name: country.names[locale] })}
              className="w-28 shrink-0 shadow-sm"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 id="entry-title" className="font-name text-4xl leading-tight tracking-tight">
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
          </div>

          <dl className="surface grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
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
                      className="underline decoration-border underline-offset-4 hover:decoration-primary"
                    >
                      {labelFor(n)}
                    </Link>
                  ) : null,
                )}
              </dd>
            </div>
          </dl>

          <section aria-labelledby="cards-title" className="flex flex-col gap-3">
            <h2 id="cards-title" className="font-name text-lg">
              {t("entry.cards")}
            </h2>
            <ul className="surface divide-y divide-border" data-testid="entry-cards">
              {COUNTRY_CARD_TYPES.map((type) => {
                const state = learner.states.get(cardId(country.id, type));
                const level = cardLevel(state);
                return (
                  <li key={type} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="size-3 rounded-sm border border-border"
                        style={{ background: `var(--mastery-${level})` }}
                      />
                      {t(`cardType.${type}`)}
                    </span>
                    <span className="text-right text-sm text-muted-foreground tabular-nums">
                      {t(`level.${level}`)}
                      {state && state.phase !== "new" ? (
                        <>
                          {" · "}
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
              focus={{ kind: "countries", ids: [country.id, ...country.neighbors] }}
              highlight={{ target: country.id, labels: [country.id] }}
              labelFor={labelFor}
              ariaLabel={t("map.label")}
              padding={0.25}
              interactive={false}
            />
          </div>

          <section aria-labelledby="history-title" className="flex flex-col gap-3">
            <h2 id="history-title" className="font-name text-lg">
              {t("entry.history")}
            </h2>
            {recent.length === 0 ? (
              <p className="text-muted-foreground">{t("entry.noHistory")}</p>
            ) : (
              <figure className="surface flex flex-col gap-2 p-4" data-testid="entry-history">
                {/* Correct is a tall bar, wrong a short one: height carries the meaning, not color. */}
                <div className="flex h-10 items-end gap-0.5" aria-hidden>
                  {recent.map((e) => (
                    <span
                      key={e.id}
                      className={
                        e.correct
                          ? "h-full flex-1 rounded-sm bg-primary"
                          : "h-1/4 flex-1 rounded-sm bg-muted-foreground/60"
                      }
                    />
                  ))}
                </div>
                <figcaption className="text-sm text-muted-foreground tabular-nums">
                  {t("entry.correct")}: {number.format(correct)} · {t("entry.wrong")}:{" "}
                  {number.format(recent.length - correct)}
                </figcaption>
              </figure>
            )}
          </section>

          <section aria-labelledby="facts-title" className="flex flex-col gap-3">
            <h2 id="facts-title" className="font-name text-lg">
              {t("entry.facts")}
            </h2>
            {facts.length === 0 ? (
              <p className="text-muted-foreground">{t("entry.noFacts")}</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="entry-facts">
                {facts.map((f) => (
                  <li key={f.id} className="surface px-4 py-3">
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
