"use client";

import {
  getDateFromStringOrThrow,
  getDateOnlyMarkdownString,
} from "@/features/local/utils/timeUtils";
import { ReactNode } from "react";
import { useCalendarItemsContext } from "../../context/calendarItemsContext";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { SyncField } from "./getAssignmentSyncStatus";
import { AssignmentScheduleEntry } from "@/features/local/assignments/models/localAssignment";
import { byOrderingDate } from "@/features/local/modules/moduleItemOrder";
import { useItemSyncStatus } from "./useItemSyncStatus";

export type TodayItem = {
  type: "assignment" | "quiz" | "page";
  item: IModuleItem;
  moduleName: string;
  status: "localOnly" | "incomplete" | "published";
  message: ReactNode;
  // every way the file and Canvas disagree; empty when in sync or not in Canvas
  differences: SyncField[];
  // in Canvas but students can't see it; red border, not a difference
  unpublished?: boolean;
  // set when this is one batch of an assignment's Schedule rather than its DueAt
  scheduleEntry?: AssignmentScheduleEntry;
};

export function useTodaysItems(day: string) {
  const dayAsDate = getDateFromStringOrThrow(
    day,
    "calculating same month in day items",
  );
  const itemsContext = useCalendarItemsContext();
  const dateKey = getDateOnlyMarkdownString(dayAsDate);
  const todaysModules = itemsContext[dateKey] ?? {};
  const { statusOf, scheduleStatusOf } = useItemSyncStatus();

  const items: TodayItem[] = Object.entries(todaysModules).flatMap(
    ([moduleName, { assignments, quizzes, pages }]) =>
      [
        ...assignments.map((item) => ({ type: "assignment" as const, item })),
        ...quizzes.map((item) => ({ type: "quiz" as const, item })),
        ...pages.map((item) => ({ type: "page" as const, item })),
      ].map(({ type, item }) => ({
        type,
        item,
        moduleName,
        ...statusOf(type, item, moduleName),
      })),
  );

  const scheduledAssignments: TodayItem[] = Object.entries(
    todaysModules,
  ).flatMap(([moduleName, { scheduledAssignments }]) =>
    (scheduledAssignments ?? []).map(({ assignment, entry }) => ({
      type: "assignment" as const,
      item: assignment,
      moduleName,
      scheduleEntry: entry,
      ...scheduleStatusOf(assignment, entry),
    })),
  );

  const todaysItems = [...items, ...scheduledAssignments].sort(
    (a, b) =>
      byOrderingDate(a.item, b.item) || a.item.name.localeCompare(b.item.name),
  );

  return { todaysItems };
}
