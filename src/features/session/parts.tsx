/** Building blocks shared by the daily session and the placement test. */
import { CheckIcon, XIcon } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Country } from "@/data/types";
import type { WorldData } from "@/data/world";
import type { Locale } from "@/i18n/locales";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { cn } from "@/ui/utils";
import type { Option, Question } from "../study/questions";

export function nameOf(world: WorldData, id: string, locale: Locale): string {
  return world.byId.get(id)?.names[locale] ?? id;
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
  const country = world.byId.get(question.entityId);
  if (!country) return null;
  const name = country.names[locale];
  const inName = inNameOf(country, locale);
  const capital = country.capitals.find((c) => c.roles.includes("primary"))?.names[locale] ?? "";
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
        return t("q.contrast", { name });
    }
  })();
  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <h2 className="font-name text-xl tracking-tight lg:text-3xl" data-testid="prompt">
        {text}
      </h2>
      {question.prompt.kind === "flag" ? (
        <Flag
          iso2={country.iso2}
          alt={t("flag.alt")}
          className="w-56 max-w-full shadow-[var(--elevation)]"
        />
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
  return (
    <ol className="stagger flex flex-col gap-2.5" data-testid="choices">
      {options.map((option, index) => (
        <li key={option.id}>
          <button
            type="button"
            className="group flex min-h-12 w-full items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-left text-base transition-[background-color,border-color,box-shadow,transform] duration-200 ease-(--ease-ui) outline-none hover:-translate-y-px hover:border-primary/60 hover:bg-background/70 hover:shadow-[var(--elevation-hover)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
            onClick={() => onPick(option.id)}
            disabled={disabled}
            data-option={option.id}
          >
            <kbd className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground transition-colors duration-200 group-hover:border-primary/60 group-hover:text-foreground">
              {index + 1}
            </kbd>
            <span>{option.label}</span>
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
    <ol className="stagger grid grid-cols-2 gap-3" data-testid="flag-choices">
      {options.map((option, index) => (
        <li key={option.id}>
          <button
            type="button"
            onClick={() => onPick(option.id)}
            disabled={disabled}
            data-option={option.id}
            className="relative block w-full rounded-lg border border-transparent p-1.5 transition-[background-color,border-color,box-shadow,transform] duration-200 ease-(--ease-ui) outline-none hover:-translate-y-0.5 hover:border-primary/60 hover:bg-background/60 hover:shadow-[var(--elevation-hover)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
          >
            <Flag iso2={option.flag ?? ""} alt={t("flag.alt")} className="w-full" />
            <kbd className="absolute top-3 left-3 flex size-6 items-center justify-center rounded-md bg-background/85 text-sm shadow-sm">
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
        "flex items-center gap-2.5 self-start rounded-full py-1 pr-4 pl-1 font-name text-lg",
        correct ? "bg-primary/15" : "bg-destructive/15",
      )}
      data-testid="status"
      data-correct={correct}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full",
          correct ? "bg-primary text-primary-foreground" : "bg-destructive text-background",
        )}
      >
        {correct ? (
          <CheckIcon aria-hidden className="size-5" strokeWidth={2.5} />
        ) : (
          <XIcon aria-hidden className="size-5" strokeWidth={2.5} />
        )}
      </span>
      <span>{correct ? t("feedback.correct") : t("feedback.wrong")}</span>
      {children}
    </p>
  );
}

/** Name, other-language name, flag and capitals with roles (PLAN.md 7.1). */
export function CountryCard({ country, locale }: { country: Country; locale: Locale }) {
  const { t } = useTranslation();
  const other: Locale = locale === "en" ? "nb" : "en";
  const capitals = country.capitals;
  return (
    <div className="surface flex items-start gap-4 p-4">
      <Flag
        iso2={country.iso2}
        alt={t("flag.of", { name: country.names[locale] })}
        className="w-20 shrink-0 shadow-sm"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-name text-2xl leading-tight tracking-tight" data-testid="answer-name">
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

/** Keyboard shortcuts for session screens (PLAN.md 8.3). */
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
