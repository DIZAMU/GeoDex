import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { ThemeSwitcher } from "@/themes/ThemeSwitcher";

export function TodayScreen() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 md:px-10 md:py-16">
      <header className="flex items-baseline justify-between gap-4">
        <span className="font-name text-lg tracking-tight">{t("app.name")}</span>
      </header>

      <section aria-labelledby="today-title" className="flex flex-col gap-3">
        <h1 id="today-title" className="font-name text-3xl md:text-4xl">
          {t("today.title")}
        </h1>
        <p className="max-w-[60ch] text-base text-muted-foreground md:text-lg">
          {t("today.empty")}
        </p>
      </section>

      <section
        aria-label={t("settings.label")}
        className="flex flex-col gap-6 rounded-xl border border-border bg-card p-4 text-card-foreground md:flex-row md:gap-10 md:p-6"
        style={{ borderWidth: "var(--border-width)" }}
      >
        <ThemeSwitcher />
        <LanguageSwitcher />
      </section>
    </div>
  );
}
