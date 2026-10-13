import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import { isLocale, LOCALES } from "./locales";
import { useLocale } from "./useLocale";

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm text-muted-foreground">{t("settings.language.label")}</legend>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={locale}
        onValueChange={(value) => {
          if (isLocale(value)) setLocale(value);
        }}
      >
        {LOCALES.map((option) => (
          <ToggleGroupItem
            key={option}
            value={option}
            lang={option}
            data-testid={`locale-${option}`}
          >
            {t(`settings.language.${option}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </fieldset>
  );
}
