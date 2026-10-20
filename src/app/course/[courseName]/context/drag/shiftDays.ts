import {
  dateToMarkdownString,
  getDateFromStringOrThrow,
} from "@/features/local/utils/timeUtils";

// Dropping an item on another day moves all its dates by the same number of
// days, each keeping its time of day, so the gaps between them stay the same.

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Whole days from `date`'s day to `day`. */
export const daysUntil = (date: string, day: string) =>
  Math.round(
    (startOfDay(getDateFromStringOrThrow(day, "drop day")).getTime() -
      startOfDay(getDateFromStringOrThrow(date, "date being moved")).getTime()) /
      86_400_000
  );

/** `date` moved by `days` calendar days at the same time of day; blank stays blank. */
export function shiftDays<T extends string | undefined>(date: T, days: number): T {
  if (!date) return date;
  const moved = getDateFromStringOrThrow(date, "date being moved");
  moved.setDate(moved.getDate() + days);
  return dateToMarkdownString(moved) as T;
}
