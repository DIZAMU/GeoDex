import { useTranslation } from "react-i18next";

const MARKED = [1, 3, 5, 8, 10] as const;

/**
 * The path from level 1 to 10 (PLAN.md 11.1): ten stops shaded with the theme's mastery
 * ramp, the marked ones labelled. Luminance carries the meaning, never hue alone.
 */
export function LevelPath({ current }: { current?: number }) {
  const { t } = useTranslation();
  const levels = Array.from({ length: 10 }, (_, i) => i + 1);
  // Map 1 to 10 onto the five ramp steps.
  const ramp = (level: number) => Math.min(4, Math.floor(((level - 1) / 9) * 4 + 0.5));
  return (
    <ol className="relative grid grid-cols-10 gap-1 pt-2" data-testid="level-path">
      <span
        aria-hidden
        className="absolute top-[calc(0.5rem+1.125rem)] right-[5%] left-[5%] h-1 -translate-y-1/2 rounded-full bg-border"
      />
      {levels.map((level) => {
        const marked = MARKED.find((m) => m === level);
        const label = marked ? t(`welcome.levels.${marked}`) : null;
        const here = current === level;
        return (
          <li key={level} className="relative flex flex-col items-center gap-2 text-center">
            <span
              className={`relative flex size-9 items-center justify-center rounded-full border text-sm font-medium tabular-nums ${here ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
              style={{
                background: `var(--mastery-${ramp(level)})`,
                color: `var(--on-mastery-${ramp(level)})`,
                borderColor: "var(--border)",
              }}
              aria-current={here ? "step" : undefined}
            >
              {level}
            </span>
            {label ? (
              <span className="text-xs leading-tight text-muted-foreground sm:text-sm">
                {label}
              </span>
            ) : (
              <span aria-hidden className="text-xs sm:text-sm">
                &nbsp;
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
