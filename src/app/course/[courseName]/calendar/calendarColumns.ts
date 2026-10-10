import {
  DayOfWeek,
  getDayOfWeek,
  LocalCourseSettings,
} from "@/features/local/course/localCourseSettings";

/** Days the calendar narrows to a strip: hidden, and not a class day. */
export const hiddenWeekdays = (settings: LocalCourseSettings) =>
  (settings.hiddenDays ?? []).filter((d) => !settings.daysOfWeek.includes(d));

export const isHiddenDay = (settings: LocalCourseSettings, date: Date) =>
  hiddenWeekdays(settings).includes(getDayOfWeek(date));

// Every week uses the same columns, hidden days included, so the weeks of a
// month still line up under the day names.
export const calendarColumnStyle = (settings: LocalCourseSettings) => {
  const hidden = hiddenWeekdays(settings);
  return {
    "--calendar-columns": Object.values(DayOfWeek)
      .map((d) => (hidden.includes(d) ? "1.75rem" : "minmax(0, 1fr)"))
      .join(" "),
  } as React.CSSProperties;
};

export const calendarGridClass = "md:[grid-template-columns:var(--calendar-columns)]";
