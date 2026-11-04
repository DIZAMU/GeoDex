import { cn } from "@/ui/utils";

/**
 * A thin bar for a share from 0 to 1: ink on the muted track. With a label it is a progress
 * bar for screen readers; without one it repeats a number shown next to it and is hidden.
 * An optional target draws a short tick, so "how far" and "how far it should be" read together.
 */
export function Meter({
  value,
  label,
  target,
  tall = false,
  className,
  testId,
}: {
  value: number;
  label?: string;
  target?: number;
  tall?: boolean;
  className?: string;
  testId?: string;
}) {
  const share = Math.min(1, Math.max(0, value));
  const a11y = label
    ? {
        role: "progressbar",
        "aria-label": label,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": Math.round(share * 100),
      }
    : { "aria-hidden": true };
  return (
    <div className={cn("relative w-full", className)} data-testid={testId} {...a11y}>
      <div className={cn("overflow-hidden rounded-full bg-muted", tall ? "h-2" : "h-1.5")}>
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-(--ease-ui)"
          style={{ width: `${share * 100}%` }}
        />
      </div>
      {target !== undefined ? (
        // The tick stands out above and below the track, so it reads over the fill too.
        <span
          className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground"
          style={{ left: `${Math.min(1, Math.max(0, target)) * 100}%` }}
        />
      ) : null}
    </div>
  );
}
