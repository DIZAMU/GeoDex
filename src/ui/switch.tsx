import type * as React from "react";
import { cn } from "@/ui/utils";

/**
 * An on/off switch (docs/PLAN-2.0.md): a real switch instead of On and Off pills. The track
 * is ink when on, never the accent, so the accent keeps its one job. The whole row label is
 * the hit target when the switch sits in a `<label>`; on its own it keeps a 44 px target.
 */
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "on" : "off"}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group/switch relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="flex h-5 w-8 items-center rounded-full bg-input p-0.5 transition-colors duration-150 ease-(--ease-ui) group-aria-checked/switch:bg-foreground"
      >
        <span className="size-4 rounded-full bg-background shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-150 ease-(--ease-ui) group-aria-checked/switch:translate-x-3 motion-reduce:transition-none" />
      </span>
    </button>
  );
}
