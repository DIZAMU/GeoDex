import { useTranslation } from "react-i18next";

/** Where every card started, every card holding a week, and every card mastered land. */
const MARKED = [1, 4, 7, 10] as const;

/**
 * The path from level 1 to 10: ten stops shaded with the theme's mastery
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
        className="absolute top-[calc(0.5rem+0.75rem)] right-[5%] left-[5%] h-1 -translate-y-1/2 rounded-full bg-border min-[360px]:top-[calc(0.5rem+0.875rem)] sm:top-[calc(0.5rem+1.125rem)]"
      />
      {levels.map((level) => {
        const marked = MARKED.find((m) => m === level);
        const label = marked ? t(`welcome.levels.${marked}`) : null;
        const here = current === level;
        return (
          <li key={level} className="relative flex flex-col items-center gap-2 text-center">
            <span
              className={`relative flex size-6 items-center justify-center rounded-full border text-[0.6875rem] font-medium tabular-nums min-[360px]:size-7 min-[360px]:text-xs sm:size-9 sm:text-sm ${here ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
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
              // On a phone a column is narrower than its label, so the label may spill into
              // the unlabelled neighbours; the ends align to the edges to stay on screen.
              <span
                className={`w-max max-w-12 text-xs leading-tight text-muted-foreground sm:w-auto sm:max-w-none sm:self-center sm:text-center sm:text-sm ${
                  level === 1 ? "self-start text-left" : level === 10 ? "self-end text-right" : ""
                }`}
              >
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
