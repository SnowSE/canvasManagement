"use client";
import { getDateFromStringOrThrow } from "@/features/local/utils/timeUtils";
import { getMonthsBetweenDates } from "./calendarMonthUtils";
import { CalendarMonth } from "./CalendarMonth";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useMemo } from "react";
import { usePersistedScroll } from "@/components/usePersistedScroll";

export default function CourseCalendar() {
  const { data: settings } = useLocalCourseSettingsQuery();

  const startDateTime = useMemo(
    () => getDateFromStringOrThrow(settings.startDate, "course start date"),
    [settings.startDate]
  );
  const endDateTime = useMemo(() => {
    const date = getDateFromStringOrThrow(settings.endDate, "course end date");
    date.setDate(date.getDate() + 14); // buffer to make sure calendar shows week of finals and grades due
    return date;
  }, [settings.endDate]);
  const months = useMemo(
    () => getMonthsBetweenDates(startDateTime, endDateTime),
    [endDateTime, startDateTime]
  );
  const scrollRef = usePersistedScroll(`courseScroll-${settings.name}`);

  return (
    <div
      className="
        min-h-0 min-w-0
        flex-1
        border-2
        border-gray-900
        rounded-lg
        bg-linear-to-br
        from-blue-950/30
        to-fuchsia-950/10 to-60%
        sm:p-1
      "
    >
      <div className="h-full overflow-y-scroll sm:pe-1" ref={scrollRef}>
        {months.map((month) => (
          <CalendarMonth key={month.month + "" + month.year} month={month} />
        ))}
      </div>
    </div>
  );
}
