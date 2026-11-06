import { CheckIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

/**
 * A short note that something happened, shown for a moment and then gone. `show` restarts the
 * timer, so a run of changes keeps one note up instead of stacking several.
 */
export function useToast(duration = 2000) {
  const [shown, setShown] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    setShown((n) => (n ?? 0) + 1);
    timer.current = window.setTimeout(() => setShown(null), duration);
  }, [duration]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { shown, show };
}

/**
 * The note itself: low on the screen, above the phone's bottom bar. The live region stays in
 * the page so screen readers hear each note; `shown` changes on every `show`, which replays
 * the entrance and the announcement.
 */
export function Toast({
  shown,
  children,
  testId,
}: {
  shown: number | null;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:bottom-8"
    >
      {shown === null ? null : (
        <div
          key={shown}
          data-testid={testId}
          className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-[var(--elevation)] motion-safe:animate-[rise_220ms_var(--ease-ui)_both]"
        >
          <CheckIcon aria-hidden className="size-4" strokeWidth={2.25} />
          {children}
        </div>
      )}
    </div>
  );
}
