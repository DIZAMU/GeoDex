/**
 * Session picker (PLAN.md 11.2): how many questions, and on what. The choice is remembered on
 * this device. A focused session shows the reviews it leaves for later.
 */
import { ChevronDownIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { CONTINENTS } from "@/data/types";
import { db } from "@/db/db";
import { setLastInputMode, setSessionPick } from "@/db/settings";
import {
  FOCUS_MODULES,
  type Focus,
  focusCounts,
  focusKey,
  MIXED,
  parseFocus,
  parseLength,
  SESSION_LENGTHS,
  SKILLS,
  sliceSession,
} from "@/engine/focus";
import type { QueueItem } from "@/engine/session";
import type { InputSetting } from "@/engine/types";
import { Button } from "@/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import { continentLookup } from "../study/plan";
import type { Learner } from "../study/useLearner";

const INPUTS: readonly InputSetting[] = ["auto", "mc", "typing"];

export function SessionPicker({
  learner,
  queue,
}: {
  learner: Learner;
  queue: readonly QueueItem[];
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const number = new Intl.NumberFormat(i18n.language);
  const continentOf = useMemo(() => continentLookup(learner.world), [learner.world]);
  const length = parseLength(learner.device.sessionLength);
  const input = learner.device.lastInputMode;

  const locale = i18n.language === "nb" ? "nb" : "en";
  const groups = useMemo(() => {
    const modules = FOCUS_MODULES.filter(
      (m) => m === "countries" || learner.settings.modules?.[m] === true,
    );
    const subregions = learner.world.subregions;
    return [
      {
        label: t("picker.skills"),
        items: SKILLS.map((id) => ({
          focus: { kind: "skill", id } as Focus,
          name: t(`skill.${id}`),
        })),
      },
      // One module has nothing to pick between.
      {
        label: t("picker.modules"),
        items:
          modules.length > 1
            ? modules.map((id) => ({
                focus: { kind: "module", id } as Focus,
                name: t(`picker.module.${id}`),
              }))
            : [],
      },
      // Each continent, then its subregions (PLAN.md 11.2).
      ...CONTINENTS.map((continent) => ({
        label: t(`continent.${continent}`),
        items: [
          {
            focus: { kind: "region", id: continent } as Focus,
            name: t("picker.allOf", { name: t(`continent.${continent}`) }),
          },
          ...subregions
            .filter((r) => r.continent === continent)
            .map((r) => ({ focus: { kind: "region", id: r.id } as Focus, name: r.names[locale] }))
            .sort((a, b) => a.name.localeCompare(b.name, locale)),
        ],
      })),
    ];
  }, [learner.settings.modules, learner.world.subregions, t, locale]);
  const counts = useMemo(
    () =>
      focusCounts(
        queue,
        [MIXED, ...groups.flatMap((g) => g.items.map((i) => i.focus))],
        continentOf,
      ),
    [queue, groups, continentOf],
  );
  // A remembered focus that is empty today (or no longer offered) falls back to Mixed.
  const remembered = parseFocus(learner.device.sessionFocus);
  const focus = (counts.get(focusKey(remembered)) ?? 0) > 0 ? remembered : MIXED;
  const slice = useMemo(
    () => sliceSession(queue, focus, length, continentOf),
    [queue, focus, length, continentOf],
  );

  const pick = (next: { length?: number; focus?: Focus }) =>
    void setSessionPick(db, {
      sessionLength: next.length ?? length,
      sessionFocus: focusKey(next.focus ?? focus),
    });
  const start = () => {
    const params = new URLSearchParams({
      input,
      length: String(length),
      focus: focusKey(focus),
    });
    navigate(`/session?${params}`, { viewTransition: true });
  };

  return (
    <div className="flex flex-col gap-5" data-testid="picker">
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-x-6">
        <span className="text-sm text-muted-foreground" id="picker-length">
          {t("picker.length")}
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={String(length)}
          aria-labelledby="picker-length"
          className="self-start"
          onValueChange={(value) => {
            if (value) pick({ length: parseLength(value) });
          }}
        >
          {SESSION_LENGTHS.map((n) => (
            <ToggleGroupItem
              key={n}
              value={String(n)}
              aria-label={t("picker.lengthOption", { count: n })}
              className="min-w-14 tabular-nums"
              data-testid={`length-${n}`}
            >
              {number.format(n)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <label className="text-sm text-muted-foreground" htmlFor="picker-focus">
          {t("picker.focus")}
        </label>
        <div className="relative max-w-sm">
          <select
            id="picker-focus"
            data-testid="focus"
            value={focusKey(focus)}
            onChange={(e) => pick({ focus: parseFocus(e.target.value) })}
            className="h-11 w-full appearance-none rounded-lg border border-input bg-background py-2 pr-10 pl-3 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="mixed">
              {t("picker.option", {
                name: t("picker.mixed"),
                count: number.format(counts.get("mixed") ?? 0),
              })}
            </option>
            {groups.map((g) =>
              g.items.length > 0 ? (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map(({ focus: f, name }) => {
                    const count = counts.get(focusKey(f)) ?? 0;
                    // Empty subregions stay out of the list; empty skills and continents show, disabled.
                    if (count === 0 && f.kind === "region" && /^\d/.test(f.id)) return null;
                    return (
                      <option key={focusKey(f)} value={focusKey(f)} disabled={count === 0}>
                        {t("picker.option", { name, count: number.format(count) })}
                      </option>
                    );
                  })}
                </optgroup>
              ) : null,
            )}
          </select>
          <ChevronDownIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>

        <span className="text-sm text-muted-foreground" id="picker-input">
          {t("today.inputMode")}
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={input}
          aria-labelledby="picker-input"
          className="self-start"
          data-tour="input"
          onValueChange={(value) => {
            if (INPUTS.includes(value as InputSetting))
              void setLastInputMode(db, value as InputSetting);
          }}
        >
          {INPUTS.map((mode) => (
            <ToggleGroupItem key={mode} value={mode} data-testid={`input-${mode}`}>
              {t(`input.${mode}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          className="self-stretch sm:self-start"
          data-testid="start"
          data-tour="start"
          disabled={slice.queue.length === 0}
          onClick={start}
        >
          {t("picker.start", { count: slice.queue.length })}
        </Button>
        {slice.dueOutside > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="outside">
            {t("picker.outside", { count: slice.dueOutside })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
