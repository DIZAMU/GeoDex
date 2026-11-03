import { CheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Country } from "@/data/types";
import { normalizeAnswer } from "@/engine/matching";
import type { Locale } from "@/i18n/locales";
import { Input } from "@/ui/input";
import { cn } from "@/ui/utils";

/** Searchable country list. Matches names and aliases in both languages. */
export function CountryPicker({
  countries,
  value,
  onChange,
  locale,
}: {
  countries: readonly Country[];
  value: string | null;
  onChange: (id: string) => void;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const sorted = useMemo(
    () => [...countries].sort((a, b) => a.names[locale].localeCompare(b.names[locale], locale)),
    [countries, locale],
  );
  const q = normalizeAnswer(query);
  const shown = q
    ? sorted.filter((c) =>
        [c.names.en, c.names.nb, ...c.aliases.en, ...c.aliases.nb].some((n) =>
          normalizeAnswer(n).includes(q),
        ),
      )
    : sorted;
  return (
    <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor="country-search">
        {t("onboarding.search")}
      </label>
      <Input
        id="country-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("onboarding.search")}
        autoComplete="off"
        data-testid="country-search"
      />
      <ul
        className="max-h-72 overflow-y-auto rounded-lg border border-border"
        aria-label={t("onboarding.home")}
      >
        {shown.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onChange(c.id)}
              aria-pressed={value === c.id}
              data-country-option={c.id}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 px-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                value === c.id && "bg-foreground font-medium text-background hover:bg-foreground",
              )}
            >
              <img
                src={`/flags/${c.iso2}.svg`}
                alt=""
                className="h-4 w-6 rounded-[2px] border border-border object-cover"
              />
              <span className="flex-1">{c.names[locale]}</span>
              {value === c.id ? <CheckIcon aria-hidden className="size-4" /> : null}
            </button>
          </li>
        ))}
        {shown.length === 0 ? (
          <li className="px-3 py-2 text-muted-foreground">{t("onboarding.noMatch")}</li>
        ) : null}
      </ul>
    </div>
  );
}

/** Guesses the home country from browser languages such as nb-NO or en-GB. */
export function guessHomeCountry(
  languages: readonly string[],
  countries: readonly Country[],
): string | null {
  for (const tag of languages) {
    const region = tag.split("-")[1]?.toLowerCase();
    if (!region) continue;
    const match = countries.find((c) => c.iso2 === region);
    if (match) return match.id;
  }
  if (languages.some((l) => /^(nb|nn|no)\b/i.test(l))) return "NOR";
  return null;
}
