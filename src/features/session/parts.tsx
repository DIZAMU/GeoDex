/** Building blocks shared by the daily session and the placement test. */
import { CheckIcon, ListIcon, XIcon } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { groupNote } from "@/data/groupNotes";
import type {
  City,
  Country,
  CountryGroup,
  HistoricalEntity,
  Landmark,
  PhysicalFeature,
} from "@/data/types";
import type { WorldData } from "@/data/world";
import { normalizeAnswer } from "@/engine/matching";
import type { Locale } from "@/i18n/locales";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { cn } from "@/ui/utils";
import type { Option, Question } from "../study/questions";

type T = ReturnType<typeof useTranslation>["t"];

/** A year as written in the active language: "27 BCE", "27 f.Kr.", "1453". */
export function formatYear(year: number, t: T): string {
  return year < 0 ? t("history.bce", { year: -year }) : String(year);
}

/** "27 BCE to 476" / "27 f.Kr. til 476". */
export function formatPeriod(period: readonly [number, number], t: T): string {
  return t("history.period", { from: formatYear(period[0], t), to: formatYear(period[1], t) });
}

export function nameOf(world: WorldData, id: string, locale: Locale): string {
  return (
    world.byId.get(id)?.names[locale] ??
    world.physicalById.get(id)?.names[locale] ??
    world.historyById.get(id)?.names[locale] ??
    id
  );
}

/** "i Laos" / "på Island" for Norwegian templates. English templates use the plain name. */
export function inNameOf(country: Country, locale: Locale): string {
  return locale === "nb" ? `${country.prepNb} ${country.names.nb}` : country.names.en;
}

export function Flag({ iso2, alt, className }: { iso2: string; alt: string; className?: string }) {
  return (
    <img
      src={`/flags/${iso2}.svg`}
      alt={alt}
      className={cn("aspect-[4/3] rounded-sm border border-border object-cover", className)}
      draggable={false}
    />
  );
}

export function PromptText({
  question,
  world,
  locale,
}: {
  question: Question;
  world: WorldData;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const country = world.byId.get(question.countryId);
  const feature = question.featureId ? world.physicalById.get(question.featureId) : undefined;
  const past = question.historyId ? world.historyById.get(question.historyId) : undefined;
  // Every card is about a country except physical ones, which may border none (Southern Ocean).
  if (!country && !feature) return null;
  const group = question.groupId ? world.groupById.get(question.groupId) : undefined;
  const phrase = group?.phrase[locale] ?? "";
  const name = country?.names[locale] ?? "";
  const city = world.cityById.get(question.entityId)?.names[locale] ?? "";
  const landmark = world.landmarkById.get(question.entityId);
  const inName = country ? inNameOf(country, locale) : "";
  const capital = country?.capitals.find((c) => c.roles.includes("primary"))?.names[locale] ?? "";
  const text = (() => {
    switch (question.type) {
      case "map_to_name":
        return t("q.map_to_name");
      case "name_to_map":
        return t("q.name_to_map", { name });
      case "country_to_capital":
        return t("q.country_to_capital", { name, inName });
      case "capital_to_country":
        return t("q.capital_to_country", { capital });
      case "flag_to_name":
        return t("q.flag_to_name");
      case "name_to_flag":
        return t("q.name_to_flag", { name });
      case "country_to_currency":
        return t("q.country_to_currency", { name, inName });
      case "country_to_language":
        return t("q.country_to_language", { name, inName });
      case "contrast":
        return question.prompt.kind === "capitalOf"
          ? t("q.capitalOf", { name, inName })
          : t("q.contrast", { name });
      case "city_to_country":
        return t("q.city_to_country", { city });
      case "city_to_map":
        return t("q.city_to_map", { city });
      case "photo_to_name":
        return t("q.photo_to_name");
      case "landmark_to_country":
        return t("q.landmark_to_country", { landmark: landmark?.names[locale] ?? "" });
      case "landmark_to_map":
        return t("q.landmark_to_map", { landmark: landmark?.names[locale] ?? "" });
      case "feature_to_map":
        return t("q.feature_to_map", { feature: feature?.names[locale] ?? "" });
      case "map_to_feature":
        return t("q.map_to_feature", {
          thisKind: feature ? t(`physical.this.${feature.kind}`) : "",
        });
      case "group_to_map":
        return t("q.group_to_map", { phrase });
      case "map_to_group":
        return t("q.map_to_group");
      case "group_member":
        return t("q.group_member", { phrase });
      case "former_name_to_country":
      case "dissolved_state_member":
      case "empire_to_era":
        return t(`q.${question.type}`, { name: past?.names[locale] ?? "" });
      case "map_to_dissolved_state":
      case "map_to_empire":
        return t(`q.${question.type}`);
    }
  })();
  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <h2
        className="text-xl font-medium lg:text-2xl"
        data-testid="prompt"
        data-card={question.cardId}
      >
        {text}
      </h2>
      {question.prompt.kind === "photo" && landmark ? (
        <LandmarkPhoto landmark={landmark} alt={t("photo.altPrompt")} />
      ) : null}
      {question.prompt.kind === "flag" && country ? (
        <Flag iso2={country.iso2} alt={t("flag.alt")} className="w-56 max-w-full" />
      ) : null}
    </div>
  );
}

export function ChoiceAnswer({
  options,
  onPick,
  disabled,
}: {
  options: readonly Option[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ol className="flex flex-col gap-2" data-testid="choices">
      {options.map((option, index) => (
        <li key={option.id}>
          <button
            type="button"
            className="group flex min-h-12 w-full items-center gap-3 rounded-lg border border-input bg-background px-3 py-2.5 text-left text-base transition-[background-color,transform] duration-150 ease-(--ease-ui) outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 motion-reduce:active:scale-100"
            onClick={() => onPick(option.id)}
            disabled={disabled}
            data-option={option.id}
          >
            <kbd className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
              {index + 1}
            </kbd>
            <span>{option.period ? formatPeriod(option.period, t) : option.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function FlagAnswer({
  options,
  onPick,
  disabled,
}: {
  options: readonly Option[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ol className="grid grid-cols-2 gap-3" data-testid="flag-choices">
      {options.map((option, index) => (
        <li key={option.id}>
          <button
            type="button"
            onClick={() => onPick(option.id)}
            disabled={disabled}
            data-option={option.id}
            className="relative block w-full rounded-lg border border-transparent p-1.5 transition-[background-color,transform] duration-150 ease-(--ease-ui) outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <Flag iso2={option.flag ?? ""} alt={t("flag.alt")} className="w-full" />
            <kbd className="absolute top-3 left-3 flex size-6 items-center justify-center rounded-md bg-background text-sm">
              {index + 1}
            </kbd>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function TypedAnswer({
  onSubmit,
  hint,
  onHint,
  onGiveUp,
}: {
  onSubmit: (text: string) => void;
  hint: string | null;
  onHint: () => void;
  onGiveUp: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) onSubmit(text);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="typed-answer">
        {t("answer.label")}
      </label>
      <Input
        ref={input}
        id="typed-answer"
        data-testid="typed-answer"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("answer.placeholder")}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        className="h-12 text-lg"
      />
      {hint ? <p className="text-muted-foreground">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{t("answer.check")}</Button>
        <Button type="button" variant="outline" onClick={onHint} disabled={hint !== null}>
          {t("answer.hint")}
        </Button>
        <Button type="button" variant="outline" onClick={onGiveUp}>
          {t("answer.giveUp")}
        </Button>
      </div>
    </form>
  );
}

export function StatusLine({
  correct,
  children,
}: {
  correct: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <p
      className={cn(
        "flex items-center gap-2 self-start text-lg font-medium",
        correct ? "text-correct" : "text-destructive",
      )}
      data-testid="status"
      data-correct={correct}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full",
          correct ? "bg-correct text-background" : "bg-destructive text-background",
        )}
      >
        {correct ? (
          <CheckIcon aria-hidden className="size-4" strokeWidth={2.5} />
        ) : (
          <XIcon aria-hidden className="size-4" strokeWidth={2.5} />
        )}
      </span>
      <span>{correct ? t("feedback.correct") : t("feedback.wrong")}</span>
      {children}
    </p>
  );
}

/** Name, other-language name, flag and capitals with roles. */
export function CountryCard({ country, locale }: { country: Country; locale: Locale }) {
  const { t } = useTranslation();
  const other: Locale = locale === "en" ? "nb" : "en";
  const capitals = country.capitals;
  return (
    <div className="surface flex items-start gap-4 p-4">
      <Flag
        iso2={country.iso2}
        alt={t("flag.of", { name: country.names[locale] })}
        className="w-20 shrink-0"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-2xl leading-tight font-medium" data-testid="answer-name">
          {country.names[locale]}
          {country.names[other] !== country.names[locale] ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground" lang={other}>
              {country.names[other]}
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground">
          {capitals.length > 1 ? t("feedback.capitals") : t("feedback.capital")}:{" "}
          {capitals
            .map((c) => {
              const roles = c.roles.filter((r) => r !== "primary");
              return roles.length
                ? `${c.names[locale]} (${roles.map((r) => t(`role.${r}`)).join(", ")})`
                : c.names[locale];
            })
            .join(", ")}
        </p>
      </div>
    </div>
  );
}

/** Feedback for a city card: the city, its country and what makes it notable. */
export function CityCard({
  city,
  country,
  locale,
  distanceKm,
}: {
  city: City;
  country: Country;
  locale: Locale;
  distanceKm?: number;
}) {
  const { t } = useTranslation();
  const other: Locale = locale === "en" ? "nb" : "en";
  const number = new Intl.NumberFormat(locale);
  const km = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "kilometer",
    maximumFractionDigits: 0,
  });
  return (
    <div className="surface flex flex-col gap-2 p-4" data-testid="city-card">
      <p className="text-2xl leading-tight font-medium" data-testid="answer-name">
        {city.names[locale]}
        {city.names[other] !== city.names[locale] ? (
          <span className="ml-2 text-sm font-normal text-muted-foreground" lang={other}>
            {city.names[other]}
          </span>
        ) : null}
      </p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <Flag iso2={country.iso2} alt="" className="w-7" />
        {t("feedback.cityIn", {
          country: country.names[locale],
          inName: inNameOf(country, locale),
        })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("feedback.population")}: {number.format(city.population)}
        {city.formerCapital ? `, ${t("feedback.formerCapital")}` : ""}
      </p>
      {distanceKm !== undefined ? (
        <p data-testid="pin-distance">
          {t("feedback.distance", { distance: km.format(distanceKm) })}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A landmark's Commons photo with its credit (author, license, link to the file page), as
 * the license requires. The browser caches it at runtime for offline use.
 */
export function LandmarkPhoto({
  landmark,
  alt,
  className,
}: {
  landmark: Landmark;
  alt: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { image } = landmark;
  return (
    <figure className={cn("flex flex-col gap-1.5", className)} data-testid="landmark-photo">
      <img
        src={image.url}
        alt={alt}
        width={image.width}
        height={image.height}
        className="max-h-[38vh] w-full rounded-lg bg-muted object-contain lg:max-h-[42vh]"
        draggable={false}
        referrerPolicy="no-referrer"
      />
      <figcaption className="text-xs text-muted-foreground" data-testid="photo-credit">
        <a
          href={image.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-border underline-offset-2 hover:text-foreground"
        >
          {t("photo.credit", { author: image.author, license: image.license })}
        </a>
      </figcaption>
    </figure>
  );
}

/** Feedback for a landmark card: name, country, photo with credit, and the pin distance. */
export function LandmarkCard({
  landmark,
  country,
  locale,
  distanceKm,
}: {
  landmark: Landmark;
  country: Country;
  locale: Locale;
  distanceKm?: number;
}) {
  const { t } = useTranslation();
  const other: Locale = locale === "en" ? "nb" : "en";
  const km = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "kilometer",
    maximumFractionDigits: 0,
  });
  return (
    <div className="surface flex flex-col gap-3 p-4" data-testid="landmark-card">
      <div className="flex flex-col gap-1">
        <p className="text-2xl leading-tight font-medium" data-testid="answer-name">
          {landmark.names[locale]}
          {landmark.names[other] !== landmark.names[locale] ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground" lang={other}>
              {landmark.names[other]}
            </span>
          ) : null}
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <Flag iso2={country.iso2} alt="" className="w-7" />
          {t("feedback.landmarkIn", {
            country: country.names[locale],
            inName: inNameOf(country, locale),
          })}
        </p>
      </div>
      <LandmarkPhoto
        landmark={landmark}
        alt={t("photo.alt", { name: landmark.names[locale] })}
        className="[&_img]:max-h-40 lg:[&_img]:max-h-56"
      />
      {distanceKm !== undefined ? (
        <p data-testid="pin-distance">
          {t("feedback.landmarkDistance", { distance: km.format(distanceKm) })}
        </p>
      ) : null}
    </div>
  );
}

/** Feedback for a physical feature: name, kind, and the countries it crosses or borders. */
export function FeatureCard({
  feature,
  world,
  locale,
}: {
  feature: PhysicalFeature;
  world: WorldData;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const other: Locale = locale === "en" ? "nb" : "en";
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const countries = feature.countries
    .filter((id) => world.byId.has(id))
    .map((id) => nameOf(world, id, locale));
  return (
    <div className="surface flex flex-col gap-2 p-4" data-testid="feature-card">
      <p className="font-serif text-2xl leading-tight italic" data-testid="answer-name">
        {feature.names[locale]}
        {feature.names[other] !== feature.names[locale] ? (
          <span className="ml-2 text-sm font-normal text-muted-foreground" lang={other}>
            {feature.names[other]}
          </span>
        ) : null}
      </p>
      <p className="text-sm text-muted-foreground">{t(`physical.kind.${feature.kind}`)}</p>
      <p data-testid="feature-countries">
        {countries.length > 0
          ? `${t("physical.countries")}: ${list.format(countries)}`
          : t("physical.noCountries")}
      </p>
    </div>
  );
}

/** The year an outline shows, and "approximate" where it is drawn by hand. */
export function OutlineCaption({ entity }: { entity: HistoricalEntity }) {
  const { t } = useTranslation();
  if (entity.kind === "former_name") return null;
  return (
    <p
      className="floating pointer-events-none absolute bottom-3 left-3 px-2.5 py-1 text-sm"
      data-testid="outline-caption"
      data-history={entity.id}
    >
      <span data-testid="outline-year">
        {t("history.snapshot", { year: formatYear(entity.outline.snapshotYear, t) })}
      </span>
      {entity.outline.approximate ? (
        <span className="text-muted-foreground" data-testid="outline-approximate">
          {" "}
          ({t("history.approximate")})
        </span>
      ) : null}
    </p>
  );
}

/** Feedback for a history card: the name, what it was, when, and what it is now. */
export function HistoryCard({
  entity,
  world,
  locale,
}: {
  entity: HistoricalEntity;
  world: WorldData;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const other: Locale = locale === "en" ? "nb" : "en";
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const names = (ids: readonly string[]) =>
    list.format(ids.filter((id) => world.byId.has(id)).map((id) => nameOf(world, id, locale)));
  return (
    <div className="surface flex flex-col gap-2 p-4" data-testid="history-card">
      <p className="text-2xl leading-tight font-medium" data-testid="answer-name">
        {entity.names[locale]}
        {entity.names[other] !== entity.names[locale] ? (
          <span className="ml-2 text-sm font-normal text-muted-foreground" lang={other}>
            {entity.names[other]}
          </span>
        ) : null}
      </p>
      <p className="text-sm text-muted-foreground">{t(`history.kind.${entity.kind}`)}</p>
      {entity.kind === "former_name" ? (
        <>
          <p data-testid="history-now">
            {t("history.nowCalled", { country: nameOf(world, entity.currentCountry, locale) })}
          </p>
          {entity.until !== null ? <p>{t("history.until", { year: entity.until })}</p> : null}
        </>
      ) : (
        <>
          <p data-testid="history-period">
            {t("history.existed", { period: formatPeriod(entity.period, t) })}
          </p>
          {entity.kind === "dissolved_state" ? (
            <p data-testid="history-successors">
              {t("history.successors")}: {names(entity.successors)}
            </p>
          ) : null}
          {entity.kind === "dissolved_state" && entity.partly.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("history.partly")}: {names(entity.partly)}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * The list alternative to map, pin and tap answers, for screen readers and keyboards
 *: filter the names, then pick one, or toggle several for tap answers.
 */
export function ListAnswer({
  options,
  onPick,
  picked,
}: {
  options: readonly { id: string; label: string }[];
  onPick: (id: string) => void;
  /** Tap answers: the ids picked so far; each pick toggles. */
  picked?: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const wanted = normalizeAnswer(filter);
  const shown = options
    .filter((o) => wanted === "" || normalizeAnswer(o.label).includes(wanted))
    .slice(0, 12);
  return (
    <div className="flex flex-col gap-2" data-testid="list-answer">
      <Button
        variant="ghost"
        className="-ml-2 self-start text-muted-foreground"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="list-answer-toggle"
      >
        <ListIcon aria-hidden />
        {t("answer.list")}
      </Button>
      {open ? (
        <>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={t("answer.filter")}
            placeholder={t("answer.filter")}
            autoFocus
            data-testid="list-answer-filter"
          />
          <ul className="flex flex-col gap-1" aria-live="polite">
            {shown.length === 0 ? (
              <li className="text-muted-foreground">{t("onboarding.noMatch")}</li>
            ) : (
              shown.map((o) => (
                <li key={o.id}>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    aria-pressed={picked ? picked.has(o.id) : undefined}
                    onClick={() => onPick(o.id)}
                    data-list-option={o.id}
                  >
                    {picked?.has(o.id) ? <CheckIcon aria-hidden /> : null}
                    {o.label}
                  </Button>
                </li>
              ))
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Tap answers: how many countries are picked, then check (Enter) or show the answer. */
export function TapAnswer({
  count,
  onCheck,
  onGiveUp,
}: {
  count: number;
  onCheck: () => void;
  onGiveUp: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3" data-testid="tap-answer">
      <p className="text-muted-foreground">{t("answer.tapHelp")}</p>
      <p className="tabular-nums" data-testid="tap-count" aria-live="polite">
        {t("answer.tapCount", { count })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onCheck} disabled={count === 0} data-testid="tap-check">
          {t("answer.check")}
        </Button>
        <Button variant="outline" onClick={onGiveUp} data-testid="give-up">
          {t("answer.giveUp")}
        </Button>
      </div>
    </div>
  );
}

/** Feedback for a group card: the group, its countries, the disputed ones, and its note. */
export function GroupCard({
  group,
  members,
  sometimes,
  world,
  locale,
}: {
  group: CountryGroup;
  members: readonly string[];
  sometimes: readonly string[];
  world: WorldData;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const other: Locale = locale === "en" ? "nb" : "en";
  const names = (ids: readonly string[]) => ids.map((id) => nameOf(world, id, locale)).sort();
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const note = group.kind === "un_subregion" ? t("group.unNote") : groupNote(group.id)?.[locale];
  return (
    <div className="surface flex flex-col gap-2 p-4" data-testid="group-card">
      <p className="text-2xl leading-tight font-medium" data-testid="answer-name">
        {group.names[locale]}
        {group.names[other] !== group.names[locale] ? (
          <span className="ml-2 text-sm font-normal text-muted-foreground" lang={other}>
            {group.names[other]}
          </span>
        ) : null}
      </p>
      <p className="text-sm text-muted-foreground">{t(`group.${group.kind}`)}</p>
      <p data-testid="group-members">
        {t("group.countries")}: {list.format(names(members))}
      </p>
      {sometimes.length > 0 ? (
        <p className="text-muted-foreground" data-testid="group-sometimes">
          {t("group.sometimes")}: {list.format(names(sometimes))}
        </p>
      ) : null}
      {note ? <p>{note}</p> : null}
    </div>
  );
}

/** Keyboard shortcuts for session screens. */
export function useSessionKeys(handlers: {
  choose?: (index: number) => void;
  proceed?: () => void;
  hint?: () => void;
  notHelpful?: () => void;
  end?: () => void;
  help?: () => void;
}) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const typing =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      const h = ref.current;
      // An open dialog (the shortcut overlay) owns the keyboard: Escape closes it, nothing more.
      if (event.defaultPrevented || document.querySelector('[role="dialog"]')) return;
      if (event.key === "Escape") {
        h.end?.();
        return;
      }
      if (typing) return;
      if (event.key === "?") {
        h.help?.();
      } else if ((event.key === "Enter" || event.key === " ") && h.proceed) {
        event.preventDefault();
        h.proceed();
      } else if (/^[1-6]$/.test(event.key) && h.choose) {
        h.choose(Number(event.key) - 1);
      } else if (event.key.toLowerCase() === "h" && h.hint) {
        h.hint();
      } else if (event.key.toLowerCase() === "n" && h.notHelpful) {
        h.notHelpful();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
