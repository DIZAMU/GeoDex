import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import { isThemePreference, THEME_PREFERENCES } from "./themes";
import { useTheme } from "./useTheme";

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { preference, setTheme } = useTheme();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm text-muted-foreground">{t("settings.theme.label")}</legend>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={preference}
        onValueChange={(value) => {
          if (isThemePreference(value)) setTheme(value);
        }}
      >
        {THEME_PREFERENCES.map((option) => (
          <ToggleGroupItem key={option} value={option} data-testid={`theme-${option}`}>
            {t(`settings.theme.${option}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </fieldset>
  );
}
