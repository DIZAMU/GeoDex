import { Tabs } from "radix-ui";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
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
import { DEFAULT_REVIEW_LIMIT, REVIEW_LIMITS } from "@/engine/budget";
import {
  FOCUS_MODULES,
  type Focus,
  focusKey,
  parseFocus,
  parseLength,
  SESSION_LENGTHS,
  SKILLS,
} from "@/engine/focus";
import { isLocale, LOCALES } from "@/i18n/locales";
import { useLocale } from "@/i18n/useLocale";
import { THEME_PREFERENCES } from "@/themes/themes";
import { useTheme } from "@/themes/useTheme";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { Select, type SelectGroup } from "@/ui/select";
import { Switch } from "@/ui/switch";
import { Toast, useToast } from "@/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import { CountryPicker } from "../onboarding/CountryPicker";
import { scopedCountries } from "../study/plan";
import { type Learner, useLearner } from "../study/useLearner";
import { DEFAULT_NEW_LIMIT } from "../today/KeepGoing";

type ReviewLimitChoice = (typeof REVIEW_LIMITS)[number] | "none";

/** The stored review limit as a choice: absent is the default, null is no limit. */
function reviewLimitChoice(stored: number | null | undefined): ReviewLimitChoice {
  if (stored === null) return "none";
  const known = REVIEW_LIMITS.find((n) => n === stored);
  return known ?? DEFAULT_REVIEW_LIMIT;
}

import { BackupSection } from "./BackupSection";

const MINUTES = [10, 15, 18, 20, 30] as const;
const COUNTDOWNS = [0, 10, 15, 20] as const;
const GOAL_SESSIONS = [1, 2, 3] as const;
const MODULE_TOGGLES = ["cities", "groups", "landmarks", "physical", "history"] as const;

/**
 * One setting: the label and what it changes on the left, the control on the right. On a
 * phone the control drops below the label.
 */
function Row({
  label,
  help,
  labelId,
  inline = false,
  children,
}: {
  label: string;
  help?: string;
  labelId: string;
  /** Keep the control beside the label on a phone too (a switch is narrow enough). */
  inline?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid gap-x-8 gap-y-3 py-4 ${inline ? "grid-cols-[minmax(0,1fr)_auto] items-center" : "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"}`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId}>{label}</span>
        {help ? <span className="text-sm text-muted-foreground">{help}</span> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A row whose control is one choice out of a few, shown as a segmented toggle. */
function Choice<T extends string | number>({
  label,
  help,
  value,
  options,
  render,
  onChange,
  testId,
}: {
  label: string;
  help?: string;
  value: T;
  options: readonly T[];
  render: (option: T) => string;
  onChange: (value: T) => void;
  testId: string;
}) {
  const id = `choice-${testId}`;
  return (
    <Row label={label} help={help} labelId={id}>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={String(value)}
        aria-labelledby={id}
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
    </Row>
  );
}

/** A row with a switch: on or off, with the effect spelled out next to it. */
function SwitchRow({
  label,
  help,
  checked,
  onChange,
  testId,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId: string;
}) {
  const id = `switch-${testId}`;
  return (
    <Row label={label} help={help} labelId={id} inline>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={id}
        data-testid={`${testId}-switch`}
      />
    </Row>
  );
}

/**
 * A block of rows. The first block of a tab has no heading: the tab names it. Later blocks in
 * the same tab (Home country, Guide, Start over) keep theirs.
 */
function Group({ title, id, children }: { title?: string; id: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={title ? `${id}-title` : undefined}
      className="flex flex-col gap-1"
      data-testid={`settings-${id}`}
    >
      {title ? (
        <h2 id={`${id}-title`} className="pt-4 text-lg font-medium">
          {title}
        </h2>
      ) : null}
      {/* Under the tab row the first block needs no top rule: the tabs already draw one. */}
      <div
        className={`flex flex-col divide-y divide-border border-border ${title ? "border-y" : "border-b"}`}
      >
        {children}
      </div>
    </section>
  );
}

/** The tabs, in order; the open one is kept in the address (?tab=). */
const TABS = ["study", "topics", "appearance", "backup"] as const;
type Tab = (typeof TABS)[number];
const isTab = (value: string | null): value is Tab => TABS.includes(value as Tab);

/** One tab's panel: the tab names it, so screen readers hear the tab, then the rows. */
function Panel({ value, children }: { value: Tab; children: ReactNode }) {
  return (
    <Tabs.Content
      value={value}
      className="flex flex-col gap-6 outline-none data-[state=active]:animate-[fade_150ms_var(--ease-ui)]"
      data-testid={`settings-tab-${value}`}
    >
      {children}
    </Tabs.Content>
  );
}

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const learner = useLearner();
  const navigate = useNavigate();
  const { setLocale } = useLocale();
  const { preference, setTheme } = useTheme();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  if (!learner) return <Loader />;
  const s = learner.settings;
  // Every change saves at once; the note confirms it once the write is done.
  const saved = (write: Promise<unknown>) => void write.then(toast.show);
  const set = (patch: Partial<SettingsRow>) => saved(updateSettings(db, patch));
  const sessionsGoal = s.dailyGoal?.kind === "sessions" ? s.dailyGoal.sessions : null;
  const requested = params.get("tab");
  const tab: Tab = isTab(requested) ? requested : "study";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-10 lg:py-8">
      <h1 className="enter text-3xl font-medium tracking-tight">{t("settings.title")}</h1>
      <Tabs.Root
        value={tab}
        onValueChange={(next) => setParams({ tab: next }, { replace: true })}
        className="flex flex-col gap-6"
      >
        {/* Underlined tabs, like the header; on a narrow phone the row scrolls sideways. */}
        <Tabs.List
          aria-label={t("settings.title")}
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] md:mx-0 md:px-0"
        >
          {TABS.map((id) => (
            <Tabs.Trigger
              key={id}
              value={id}
              data-testid={`tab-${id}`}
              className="-mb-px flex h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[state=active]:border-foreground data-[state=active]:font-medium data-[state=active]:text-foreground"
            >
              {t(`settings.tabs.${id}`)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Panel value="study">
          <Group id="study">
            <Choice
              label={t("settings.dailyMinutes")}
              help={t("settings.dailyMinutesHelp")}
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
              label={t("settings.reviewLimit")}
              help={t("settings.reviewLimitHelp")}
              value={reviewLimitChoice(s.reviewsPerDay)}
              options={[...REVIEW_LIMITS, "none"] as const}
              render={(n) => (n === "none" ? t("settings.noLimit") : String(n))}
              onChange={(n) => set({ reviewsPerDay: n === "none" ? null : n })}
              testId="review-limit"
            />
            <Choice
              label={t("settings.newLimit")}
              help={t("settings.newLimitHelp")}
              // 25 is the default: no override, so new cards also fit the daily time.
              value={
                s.newPerDayOverride === null || s.newPerDayOverride < 50
                  ? DEFAULT_NEW_LIMIT
                  : s.newPerDayOverride < 100
                    ? 50
                    : 100
              }
              options={[DEFAULT_NEW_LIMIT, 50, 100] as const}
              render={(n) => String(n)}
              onChange={(n) => set({ newPerDayOverride: n === DEFAULT_NEW_LIMIT ? null : n })}
              testId="new-limit"
            />
            <Choice
              label={t("settings.goalKind")}
              help={t("settings.goalHelp")}
              value={sessionsGoal === null ? "minutes" : "sessions"}
              options={["minutes", "sessions"] as const}
              render={(v) => t(v === "minutes" ? "settings.goalMinutes" : "settings.goalSessions")}
              onChange={(v) =>
                set({
                  dailyGoal:
                    v === "minutes" ? { kind: "minutes" } : { kind: "sessions", sessions: 1 },
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
            <SessionDefaults learner={learner} saved={saved} />
            <Choice
              label={t("settings.countdown")}
              help={t("settings.countdownHelp")}
              value={s.countdownSeconds}
              options={COUNTDOWNS}
              render={(n) =>
                n === 0 ? t("settings.countdownOff") : t("settings.seconds", { count: n })
              }
              onChange={(countdownSeconds) => set({ countdownSeconds })}
              testId="countdown"
            />
          </Group>

          <Group title={t("settings.homeCountry")} id="home">
            <div className="flex flex-col gap-3 py-4">
              <p className="text-sm text-muted-foreground">{t("settings.homeCountryHelp")}</p>
              <CountryPicker
                countries={scopedCountries(learner.world, s)}
                value={s.homeCountry}
                onChange={(homeCountry) => set({ homeCountry })}
                locale={locale}
              />
            </div>
          </Group>

          <Group title={t("settings.groupGuide")} id="guide">
            <div className="flex flex-wrap gap-3 py-4">
              <Button
                variant="secondary"
                data-testid="tour-again"
                onClick={async () => {
                  await setTourDone(db, null);
                  navigate("/", { viewTransition: true });
                }}
              >
                {t("help.replayTour")}
              </Button>
              <Button
                variant="ghost"
                data-testid="welcome-again"
                onClick={async () => {
                  await setTourDone(db, null);
                  navigate("/welcome", { viewTransition: true });
                }}
              >
                {t("settings.welcomeAgain")}
              </Button>
            </div>
          </Group>
        </Panel>
        <Panel value="topics">
          <Group id="topics">
            <SwitchRow
              label={t("settings.topic.currencyLanguage.label")}
              help={t("settings.topic.currencyLanguage.detail")}
              checked={s.currencyAndLanguage}
              onChange={(currencyAndLanguage) => set({ currencyAndLanguage })}
              testId="stage4"
            />
            {MODULE_TOGGLES.map((m) => (
              <SwitchRow
                key={m}
                label={t(`settings.topic.${m}.label`)}
                help={t(`settings.topic.${m}.detail`)}
                checked={s.modules[m] === true}
                onChange={(on) => set({ modules: { ...s.modules, [m]: on } })}
                testId={`module-${m}`}
              />
            ))}
          </Group>
        </Panel>
        <Panel value="appearance">
          <Group id="look">
            <Choice
              label={t("settings.language.label")}
              value={locale}
              options={LOCALES}
              render={(l) => t(`settings.language.${l}`)}
              onChange={(l) => saved(setLocale(l))}
              testId="locale"
            />
            <Choice
              label={t("settings.theme.label")}
              value={preference}
              options={THEME_PREFERENCES}
              render={(p) => t(`settings.theme.${p}`)}
              onChange={(p) => saved(setTheme(p))}
              testId="theme"
            />
            <SwitchRow
              label={t("settings.sound")}
              help={t("settings.soundHelp")}
              checked={learner.device.soundOn !== false}
              onChange={(soundOn) => saved(setFeedbackPref(db, { soundOn }))}
              testId="sound"
            />
            <SwitchRow
              label={t("settings.vibration")}
              help={t("settings.vibrationHelp")}
              checked={learner.device.vibrationOn !== false}
              onChange={(vibrationOn) => saved(setFeedbackPref(db, { vibrationOn }))}
              testId="vibration"
            />
            <Choice
              label={t("settings.levelProgress")}
              help={t("settings.levelProgressHelp")}
              value={learner.device.levelProgress === "percent" ? "percent" : "cards"}
              options={["cards", "percent"] as const}
              render={(v) => t(v === "cards" ? "settings.levelCards" : "settings.levelPercent")}
              onChange={(v) => saved(setLevelProgress(db, v))}
              testId="level-progress"
            />
          </Group>
        </Panel>
        <Panel value="backup">
          <Group id="backup">
            <div className="py-4">
              <BackupSection learner={learner} />
            </div>
          </Group>

          <Group title={t("reset.title")} id="reset">
            <div className="py-4">
              <ResetProgress learner={learner} />
            </div>
          </Group>
        </Panel>
      </Tabs.Root>
      <Toast shown={toast.shown} testId="settings-saved">
        {t("settings.saved")}
      </Toast>
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

/**
 * Today can remember a focus this list does not offer (a subregion, or a topic since turned
 * off). It is listed too, so the list shows what is saved rather than an empty button.
 */
function withCurrent(
  groups: SelectGroup[],
  focus: Focus,
  place: (focus: Focus) => { group: number; label: string } | null,
): SelectGroup[] {
  const value = focusKey(focus);
  if (groups.some((g) => g.options.some((o) => o.value === value))) return groups;
  const spot = place(focus);
  if (!spot) return groups;
  return groups.map((g, i) =>
    i === spot.group ? { ...g, options: [...g.options, { value, label: spot.label }] } : g,
  );
}

/** The session picker's defaults: the same values Today remembers. */
function SessionDefaults({
  learner,
  saved,
}: {
  learner: Learner;
  saved: (write: Promise<unknown>) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const length = parseLength(learner.device.sessionLength);
  const focus = parseFocus(learner.device.sessionFocus);
  const save = (next: { length?: number; focus?: Focus }) =>
    saved(
      setSessionPick(db, {
        sessionLength: next.length ?? length,
        sessionFocus: focusKey(next.focus ?? focus),
      }),
    );
  const modules = FOCUS_MODULES.filter(
    (m) => m === "countries" || learner.settings.modules[m] === true,
  );
  return (
    <>
      <Choice
        label={t("settings.sessionLength")}
        help={t("settings.sessionLengthHelp")}
        value={length}
        options={SESSION_LENGTHS}
        render={(n) => t("picker.lengthOption", { count: n })}
        onChange={(n) => save({ length: n })}
        testId="default-length"
      />
      <Row
        label={t("settings.sessionFocus")}
        help={t("settings.sessionFocusHelp")}
        labelId="focus-label"
      >
        <Select
          className="w-full sm:w-72"
          value={focusKey(focus)}
          onValueChange={(value) => save({ focus: parseFocus(value) })}
          labelledBy="focus-label"
          testId="default-focus"
          groups={withCurrent(
            [
              { options: [{ value: "mixed", label: t("picker.mixed") }] },
              {
                label: t("picker.skills"),
                options: SKILLS.map((id) => ({ value: `skill:${id}`, label: t(`skill.${id}`) })),
              },
              {
                label: t("picker.modules"),
                options:
                  modules.length > 1
                    ? modules.map((id) => ({
                        value: `module:${id}`,
                        label: t(`picker.module.${id}`),
                      }))
                    : [],
              },
              {
                label: t("picker.regions"),
                options: CONTINENTS.map((id) => ({
                  value: `region:${id}`,
                  label: t(`continent.${id}`),
                })),
              },
            ],
            focus,
            (f) =>
              f.kind === "module"
                ? { group: 2, label: t(`picker.module.${f.id}`) }
                : f.kind === "region"
                  ? {
                      group: 3,
                      label:
                        learner.world.subregions.find((r) => r.id === f.id)?.names[locale] ?? f.id,
                    }
                  : null,
          )}
        />
      </Row>
    </>
  );
}
