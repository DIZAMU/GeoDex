import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { cn } from "@/ui/utils";

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectGroup = { label?: string; options: SelectOption[] };

/**
 * A list of choices that opens below its button, as wide as the button, and scrolls inside
 * the room left on screen. A native select decides that itself: with a long list near the
 * middle of the screen it opens upward over the page. Groups keep their headings; an option
 * with nothing in it shows but cannot be picked.
 */
export function Select({
  value,
  onValueChange,
  groups,
  labelledBy,
  testId,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  groups: SelectGroup[];
  /** Id of the visible label that names the list. */
  labelledBy: string;
  testId?: string;
  className?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-labelledby={labelledBy}
        data-testid={testId}
        data-value={value}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background pr-3 pl-3 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-muted",
          className,
        )}
      >
        <span className="min-w-0 truncate">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={12}
          // Always below the button; the list scrolls in the room that is left.
          avoidCollisions={false}
          className="floating z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-56 overflow-hidden text-sm data-[state=open]:animate-[fade_120ms_var(--ease-ui)]"
          data-testid={testId ? `${testId}-list` : undefined}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-muted-foreground">
            <ChevronDownIcon aria-hidden className="size-4 rotate-180" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {groups.map((group, i) =>
              group.options.length === 0 ? null : (
                <SelectPrimitive.Group key={group.label ?? `group-${i}`}>
                  {group.label ? (
                    <SelectPrimitive.Label className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                      {group.label}
                    </SelectPrimitive.Label>
                  ) : null}
                  {group.options.map((option) => (
                    <SelectPrimitive.Item
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      data-value={option.value}
                      className="relative flex min-h-10 cursor-default items-center rounded-md py-2 pr-8 pl-2 outline-none select-none data-[disabled]:text-muted-foreground data-[disabled]:opacity-60 data-[highlighted]:bg-muted"
                    >
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
                        <CheckIcon aria-hidden className="size-4" />
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Group>
              ),
            )}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-muted-foreground">
            <ChevronDownIcon aria-hidden className="size-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
