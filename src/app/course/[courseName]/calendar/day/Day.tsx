"use client";
import {
  getDateFromStringOrThrow,
  getDateOnlyMarkdownString,
} from "@/features/local/utils/timeUtils";
import { useDraggingContext } from "../../context/drag/draggingContext";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { ItemInDay } from "./itemInDay/ItemInDay";
import { useTodaysItems } from "./useTodaysItems";
import { DayTitle } from "./DayTitle";
import { getDayOfWeek } from "@/features/local/course/localCourseSettings";

export default function Day({ day, month }: { day: string; month: number }) {
  const dayAsDate = getDateFromStringOrThrow(
    day,
    "calculating same month in day",
  );
  const isToday =
    getDateOnlyMarkdownString(new Date()) ===
    getDateOnlyMarkdownString(dayAsDate);

  const { data: settings } = useLocalCourseSettingsQuery();
  const { itemDropOnDay } = useDraggingContext();

  const { todaysItems } = useTodaysItems(day);

  // a week that straddles two months is drawn in both, but each month only
  // fills in its own days — the neighbouring month's cells stay blank so the
  // grid lines up the way a printed calendar does. On mobile days stack in a
  // single column, so the blanks are dropped entirely there.
  if (dayAsDate.getMonth() + 1 !== month) {
    return <div className="hidden md:block sm:m-1 m-0.5 min-h-10" />;
  }
  const classOnThisDay = settings.daysOfWeek.includes(getDayOfWeek(dayAsDate));

  // maybe this is slow?
  const holidayNameToday = settings.holidays.reduce(
    (holidaysHappeningToday, holiday) => {
      const holidayDates = holiday.days.map((d) =>
        getDateOnlyMarkdownString(
          getDateFromStringOrThrow(d, "holiday date in day component"),
        ),
      );
      const today = getDateOnlyMarkdownString(dayAsDate);

      if (holidayDates.includes(today))
        return [...holidaysHappeningToday, holiday.name];
      return holidaysHappeningToday;
    },
    [] as string[],
  );

  const semesterStart = getDateFromStringOrThrow(
    settings.startDate,
    "comparing start date in day",
  );
  const semesterEnd = getDateFromStringOrThrow(
    settings.endDate,
    "comparing end date in day",
  );

  const isInSemester = semesterStart < dayAsDate && semesterEnd > dayAsDate;

  const meetingClasses =
    classOnThisDay && isInSemester && holidayNameToday.length === 0
      ? " bg-slate-900 "
      : " bg-gray-950";

  const todayClasses = isToday
    ? " border  border-blue-700 shadow-[0_0px_10px_0px] shadow-blue-500/50 "
    : " border border-slate-700 ";

  return (
    <div
      className={
        " rounded-lg sm:m-1 m-0.5 min-h-10 " + meetingClasses + todayClasses
      }
      onDrop={(e) => itemDropOnDay(e, day)}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="draggingDay flex flex-col">
        <DayTitle day={day} dayAsDate={dayAsDate} />
        <div className="grow">
          {todaysItems.map(({ type, item, moduleName, status, message }) => (
            <ItemInDay
              key={`${type}-${item.name}`}
              type={type}
              moduleName={moduleName}
              item={item}
              status={status}
              message={message}
            />
          ))}
        </div>
        <div>
          {holidayNameToday.map((n) => (
            <div key={n} className="font-extrabold text-blue-100 text-center">
              {n}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
