import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { CONTINENTS } from "@/data/types";
import { db, type SettingsRow } from "@/db/db";
import { resetProgress } from "@/db/reviews";
import {
  setFeedbackPref,
  setLevelProgress,
  setSessionPick,
  setTourDone,
  updateSettings,
} from "@/db/settings";
import {
  FOCUS_MODULES,
  type Focus,
  focusKey,
  parseFocus,
  parseLength,
  SESSION_LENGTHS,
  SKILLS,
} from "@/engine/focus";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { isLocale } from "@/i18n/locales";
import { ThemeSwitcher } from "@/themes/ThemeSwitcher";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { Switch } from "@/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import { CountryPicker } from "../onboarding/CountryPicker";
import { scopedCountries } from "../study/plan";
import { type Learner, useLearner } from "../study/useLearner";
import { BackupSection } from "./BackupSection";

const MINUTES = [10, 15, 18, 20, 30] as const;
const COUNTDOWNS = [0, 10, 15, 20] as const;
const GOAL_SESSIONS = [1, 2, 3] as const;
const MODULE_TOGGLES = ["cities", "groups", "landmarks", "physical", "history"] as const;

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

/** One setting with a switch: the label and its effect on the left, the switch on the right. */
function SwitchRow({
  label,
  detail,
  checked,
  onChange,
  testId,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId: string;
}) {
  const id = `switch-${testId}`;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        <span id={id}>{label}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={id}
        data-testid={`${testId}-switch`}
      />
    </div>
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
  const sessionsGoal = s.dailyGoal?.kind === "sessions" ? s.dailyGoal.sessions : null;

  return (
    <div className="stagger mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-10 md:py-14">
      <h1 className="font-name text-4xl tracking-tight">{t("settings.title")}</h1>
      <Group title={t("settings.groupLook")}>
        <LanguageSwitcher />
        <ThemeSwitcher />
      </Group>
      <Group title={t("settings.groupGoals")}>
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
        <p className="-mt-3 text-sm text-muted-foreground">{t("settings.dailyMinutesHelp")}</p>
        <Choice
          label={t("settings.goalKind")}
          value={sessionsGoal === null ? "minutes" : "sessions"}
          options={["minutes", "sessions"] as const}
          render={(v) => t(v === "minutes" ? "settings.goalMinutes" : "settings.goalSessions")}
          onChange={(v) =>
            set({
              dailyGoal: v === "minutes" ? { kind: "minutes" } : { kind: "sessions", sessions: 1 },
            })
          }
          testId="goal"
        />
        {sessionsGoal !== null ? (
          <Choice
            label={t("settings.sessionsPerDay")}
            value={
              GOAL_SESSIONS.includes(sessionsGoal as (typeof GOAL_SESSIONS)[number])
                ? (sessionsGoal as (typeof GOAL_SESSIONS)[number])
                : 1
            }
            options={GOAL_SESSIONS}
            render={(n) => t("settings.sessions", { count: n })}
            onChange={(sessions) => set({ dailyGoal: { kind: "sessions", sessions } })}
            testId="goal-sessions"
          />
        ) : null}
        <p className="-mt-3 text-sm text-muted-foreground">{t("settings.goalHelp")}</p>
        <SessionDefaults learner={learner} />
        <Choice
          label={t("settings.levelProgress")}
          value={learner.device.levelProgress === "percent" ? "percent" : "cards"}
          options={["cards", "percent"] as const}
          render={(v) => t(v === "cards" ? "settings.levelCards" : "settings.levelPercent")}
          onChange={(v) => void setLevelProgress(db, v)}
          testId="level-progress"
        />
      </Group>
      <Group title={t("settings.groupTopics")}>
        <Choice
          label={t("settings.currencyLanguage")}
          value={s.currencyAndLanguage ? "on" : "off"}
          options={["on", "off"] as const}
          render={(v) => (v === "on" ? t("settings.on") : t("settings.off"))}
          onChange={(v) => set({ currencyAndLanguage: v === "on" })}
          testId="stage4"
        />
        {MODULE_TOGGLES.map((m) => (
          <Choice
            key={m}
            label={t(`settings.${m}`)}
            value={s.modules[m] ? "on" : "off"}
            options={["on", "off"] as const}
            render={(v) => (v === "on" ? t("settings.on") : t("settings.off"))}
            onChange={(v) => set({ modules: { ...s.modules, [m]: v === "on" } })}
            testId={`module-${m}`}
          />
        ))}
      </Group>
      <Group title={t("settings.groupStudy")}>
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
        <SwitchRow
          label={t("settings.sound")}
          detail={t("settings.soundHelp")}
          checked={learner.device.soundOn !== false}
          onChange={(soundOn) => void setFeedbackPref(db, { soundOn })}
          testId="sound"
        />
        <SwitchRow
          label={t("settings.vibration")}
          detail={t("settings.vibrationHelp")}
          checked={learner.device.vibrationOn !== false}
          onChange={(vibrationOn) => void setFeedbackPref(db, { vibrationOn })}
          testId="vibration"
        />
      </Group>
      <Group title={t("settings.groupGuide")}>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            data-testid="welcome-again"
            onClick={async () => {
              await setTourDone(db, null);
              navigate("/welcome", { viewTransition: true });
            }}
          >
            {t("settings.welcomeAgain")}
          </Button>
          <Button
            variant="outline"
            data-testid="tour-again"
            onClick={async () => {
              await setTourDone(db, null);
              navigate("/", { viewTransition: true });
            }}
          >
            {t("help.replayTour")}
          </Button>
        </div>
      </Group>
      <Group title={t("reset.title")}>
        <ResetProgress learner={learner} />
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

/** Reset progress, behind a confirm step. Events are kept (CONTRIBUTING.md invariant 1). */
function ResetProgress({ learner }: { learner: Learner }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-3" data-testid="reset-progress">
      <p className="max-w-[60ch] text-muted-foreground">{t("reset.body")}</p>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="w-full font-medium">{t("reset.confirm")}</p>
          <Button
            variant="destructive"
            onClick={async () => {
              await resetProgress(db, learner.scheduler);
              navigate("/", { viewTransition: true });
            }}
            data-testid="reset-confirm"
          >
            {t("reset.yes")}
          </Button>
          <Button variant="outline" onClick={() => setConfirming(false)} data-testid="reset-cancel">
            {t("reset.cancel")}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setConfirming(true)}
          data-testid="reset-start"
        >
          {t("reset.button")}
        </Button>
      )}
    </div>
  );
}

/** The session picker's defaults (PLAN.md 11.4): the same values Today remembers. */
function SessionDefaults({ learner }: { learner: Learner }) {
  const { t } = useTranslation();
  const length = parseLength(learner.device.sessionLength);
  const focus = parseFocus(learner.device.sessionFocus);
  const save = (next: { length?: number; focus?: Focus }) =>
    void setSessionPick(db, {
      sessionLength: next.length ?? length,
      sessionFocus: focusKey(next.focus ?? focus),
    });
  const modules = FOCUS_MODULES.filter(
    (m) => m === "countries" || learner.settings.modules[m] === true,
  );
  return (
    <>
      <Choice
        label={t("settings.sessionLength")}
        value={length}
        options={SESSION_LENGTHS}
        render={(n) => t("picker.lengthOption", { count: n })}
        onChange={(n) => save({ length: n })}
        testId="default-length"
      />
      <label className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">{t("settings.sessionFocus")}</span>
        <div className="relative max-w-sm">
          <select
            data-testid="default-focus"
            value={focusKey(focus)}
            onChange={(e) => save({ focus: parseFocus(e.target.value) })}
            className="h-10 w-full appearance-none rounded-lg border border-border bg-card/60 py-2 pr-10 pl-3 text-sm shadow-xs outline-none transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="mixed">{t("picker.mixed")}</option>
            <optgroup label={t("picker.skills")}>
              {SKILLS.map((id) => (
                <option key={id} value={`skill:${id}`}>
                  {t(`skill.${id}`)}
                </option>
              ))}
            </optgroup>
            {modules.length > 1 ? (
              <optgroup label={t("picker.modules")}>
                {modules.map((id) => (
                  <option key={id} value={`module:${id}`}>
                    {t(`picker.module.${id}`)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label={t("picker.regions")}>
              {CONTINENTS.map((id) => (
                <option key={id} value={`region:${id}`}>
                  {t(`continent.${id}`)}
                </option>
              ))}
            </optgroup>
          </select>
          <ChevronDownIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </label>
    </>
  );
}
