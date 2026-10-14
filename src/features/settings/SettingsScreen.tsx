import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { db, type SettingsRow } from "@/db/db";
import { updateSettings } from "@/db/settings";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { isLocale } from "@/i18n/locales";
import { ThemeSwitcher } from "@/themes/ThemeSwitcher";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import { CountryPicker } from "../onboarding/CountryPicker";
import { scopedCountries } from "../study/plan";
import { useLearner } from "../study/useLearner";
import { BackupSection } from "./BackupSection";
import { SyncSection } from "./SyncSection";

const MINUTES = [10, 15, 18, 20, 30] as const;
const COUNTDOWNS = [0, 10, 15, 20] as const;

function Choice<T extends string | number>({
  label,
  value,
  options,
  render,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: readonly T[];
  render: (option: T) => string;
  onChange: (value: T) => void;
  testId: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm text-muted-foreground">{label}</legend>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={String(value)}
        onValueChange={(next) => {
          const match = options.find((o) => String(o) === next);
          if (match !== undefined) onChange(match);
        }}
        className="flex-wrap"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={String(option)}
            value={String(option)}
            data-testid={`${testId}-${option}`}
          >
            {render(option)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </fieldset>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface flex flex-col gap-6 p-5 md:p-7">
      <h2 className="font-name text-lg">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const learner = useLearner();
  const navigate = useNavigate();
  if (!learner) return <Loader />;
  const s = learner.settings;
  const set = (patch: Partial<SettingsRow>) => void updateSettings(db, patch);

  return (
    <div className="stagger mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-10 md:py-14">
      <h1 className="font-name text-4xl tracking-tight">{t("settings.title")}</h1>
      <Group title={t("settings.groupLook")}>
        <LanguageSwitcher />
        <ThemeSwitcher />
      </Group>
      <Group title={t("settings.groupStudy")}>
        <Choice
          label={t("settings.dailyMinutes")}
          value={
            MINUTES.includes(s.dailyMinutes as (typeof MINUTES)[number])
              ? (s.dailyMinutes as (typeof MINUTES)[number])
              : 18
          }
          options={MINUTES}
          render={(m) => t("settings.minutes", { count: m })}
          onChange={(dailyMinutes) => set({ dailyMinutes })}
          testId="minutes"
        />
        <Choice
          label={t("settings.countdown")}
          value={s.countdownSeconds}
          options={COUNTDOWNS}
          render={(n) =>
            n === 0 ? t("settings.countdownOff") : t("settings.seconds", { count: n })
          }
          onChange={(countdownSeconds) => set({ countdownSeconds })}
          testId="countdown"
        />
        <Choice
          label={t("settings.currencyLanguage")}
          value={s.currencyAndLanguage ? "on" : "off"}
          options={["on", "off"] as const}
          render={(v) => (v === "on" ? t("settings.on") : t("settings.off"))}
          onChange={(v) => set({ currencyAndLanguage: v === "on" })}
          testId="stage4"
        />
        <Choice
          label={t("settings.cities")}
          value={s.modules.cities ? "on" : "off"}
          options={["on", "off"] as const}
          render={(v) => (v === "on" ? t("settings.on") : t("settings.off"))}
          onChange={(v) => set({ modules: { ...s.modules, cities: v === "on" } })}
          testId="module-cities"
        />
        <Choice
          label={t("settings.groups")}
          value={s.modules.groups ? "on" : "off"}
          options={["on", "off"] as const}
          render={(v) => (v === "on" ? t("settings.on") : t("settings.off"))}
          onChange={(v) => set({ modules: { ...s.modules, groups: v === "on" } })}
          testId="module-groups"
        />
        <Choice
          label={t("settings.landmarks")}
          value={s.modules.landmarks ? "on" : "off"}
          options={["on", "off"] as const}
          render={(v) => (v === "on" ? t("settings.on") : t("settings.off"))}
          onChange={(v) => set({ modules: { ...s.modules, landmarks: v === "on" } })}
          testId="module-landmarks"
        />
        <Button
          variant="outline"
          className="self-start"
          onClick={async () => {
            await db.placementProgress.clear();
            navigate("/placement", { viewTransition: true });
          }}
        >
          {t("settings.rerunPlacement")}
        </Button>
      </Group>
      <Group title={t("sync.title")}>
        <SyncSection />
      </Group>
      <Group title={t("backup.title")}>
        <BackupSection learner={learner} />
      </Group>
      <Group title={t("settings.homeCountry")}>
        <CountryPicker
          countries={scopedCountries(learner.world, s)}
          value={s.homeCountry}
          onChange={(homeCountry) => set({ homeCountry })}
          locale={locale}
        />
      </Group>
    </div>
  );
}
