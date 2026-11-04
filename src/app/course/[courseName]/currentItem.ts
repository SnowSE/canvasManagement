import { useRouterState } from "@tanstack/react-router";
import { CourseItemType } from "@/features/local/course/courseItemTypes";
import { getDayOfWeek, LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { getDateFromString, getDateOnlyMarkdownString } from "@/features/local/utils/timeUtils";

export type CurrentItem =
  | { kind: "item"; moduleName: string; type: CourseItemType; name: string }
  | { kind: "lecture"; lectureDay: string };

const typeByUrl: Record<string, CourseItemType> = {
  assignment: "Assignment",
  quiz: "Quiz",
  page: "Page",
};

/** The item a course url is about, which the item panes (editor, compare, history, …) show; none on the course page. */
export function currentItemFromPath(pathname: string): CurrentItem | undefined {
  const item = /^\/course\/[^/]+\/modules\/([^/]+)\/(assignment|quiz|page)\/([^/]+)/.exec(pathname);
  if (item)
    return {
      kind: "item",
      moduleName: decodeURIComponent(item[1]),
      type: typeByUrl[item[2]],
      name: decodeURIComponent(item[3]),
    };
  const lecture = /^\/course\/[^/]+\/lecture\/([^/]+)/.exec(pathname);
  const date = lecture && getDateFromString(decodeURIComponent(lecture[1]));
  if (date) return { kind: "lecture", lectureDay: getDateOnlyMarkdownString(date) };
  return undefined;
}

/**
 * The lecture the course page opens into: today's, when today is a class
 * day; else the next class day's; else the term's last. None for a course
 * without class days.
 */
export function defaultLectureDay(
  settings: Pick<LocalCourseSettings, "startDate" | "endDate" | "daysOfWeek" | "holidays">,
  today: Date,
): string | undefined {
  const start = getDateFromString(settings.startDate);
  const end = getDateFromString(settings.endDate);
  if (!start || !end) return undefined;
  const holidays = new Set(settings.holidays.flatMap((h) => h.days));
  const todayStart = new Date(today).setHours(0, 0, 0, 0);
  let last: string | undefined;
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const name = getDateOnlyMarkdownString(day);
    if (!settings.daysOfWeek.includes(getDayOfWeek(day)) || holidays.has(name)) continue;
    if (new Date(day).setHours(0, 0, 0, 0) >= todayStart) return name;
    last = name;
  }
  return last;
}

export function useCurrentItem() {
  return useRouterState({
    select: (s) => currentItemFromPath(s.location.pathname),
    structuralSharing: true,
  });
}
