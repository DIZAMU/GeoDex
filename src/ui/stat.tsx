import { cn } from "@/ui/utils";

/** One figure with its label, for summaries (Today, placement result). */
export function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("surface flex flex-col gap-1 px-4 py-3 lg:px-5 lg:py-4", className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-name text-2xl tabular-nums lg:text-3xl">{value}</dd>
    </div>
  );
}
