/** Learning day boundaries. A day starts at dayStartHour local time (default 04:00). */

export const DEFAULT_DAY_START_HOUR = 4;

/** Start and end (exclusive) of the learning day containing `now`, in local time. */
export function learningDay(
  now: number,
  dayStartHour = DEFAULT_DAY_START_HOUR,
): { start: number; end: number } {
  const date = new Date(now);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), dayStartHour);
  if (start.getTime() > now) start.setDate(start.getDate() - 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}
