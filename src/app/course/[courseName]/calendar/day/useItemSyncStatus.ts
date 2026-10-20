"use client";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useCanvasAssignmentsQuery } from "@/features/canvas/hooks/canvasAssignmentHooks";
import { useCanvasPagesQuery } from "@/features/canvas/hooks/canvasPageHooks";
import { useCanvasQuizzesQuery } from "@/features/canvas/hooks/canvasQuizHooks";
import {
  useRosterGroupSetsQuery,
  useRosterStudentsQuery,
} from "@/features/canvas/roster/rosterHooks";
import { useCanvasModulesWithItemsQuery } from "@/features/canvas/hooks/canvasModuleHooks";
import { canvasModuleNames } from "@/features/canvas/services/canvasModuleService";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { LocalAssignment, AssignmentScheduleEntry } from "@/features/local/assignments/models/localAssignment";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { useCalendarQuizQuestions } from "../../context/CalendarQuizQuestionsProvider";
import { getScheduleEntryStatus, getSyncStatus } from "./getAssignmentSyncStatus";

export type ItemType = "assignment" | "quiz" | "page";

/**
 * How each item stands against Canvas, for the calendar and the module list:
 * `statusOf` finds the item in Canvas by name and compares them, and
 * `scheduleStatusOf` does the same for one batch of an assignment's Schedule.
 */
export function useItemSyncStatus() {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasAssignments } = useCanvasAssignmentsQuery();
  const { data: canvasQuizzes } = useCanvasQuizzesQuery();
  const { data: canvasPages } = useCanvasPagesQuery();
  const { data: rosterStudents } = useRosterStudentsQuery();
  const { data: rosterGroupSets } = useRosterGroupSetsQuery();
  const roster = { students: rosterStudents, groupSets: rosterGroupSets };
  // filled in the background for this week's and the next three weeks' quizzes
  const quizQuestions = useCalendarQuizQuestions();
  const { data: canvasModules } = useCanvasModulesWithItemsQuery();
  const module = (
    file: string,
    type: ItemType,
    canvasItem: { id?: number; url?: string } | undefined,
  ) =>
    canvasModules && canvasItem
      ? { file, canvas: canvasModuleNames(canvasModules, type, canvasItem) }
      : undefined;

  const statusOf = (type: ItemType, item: IModuleItem, moduleName: string) => {
    if (type === "assignment") {
      const canvasAssignment = canvasAssignments?.find((c) => c.name === item.name);
      return getSyncStatus({
        item: item as LocalAssignment,
        canvasItem: canvasAssignment,
        type,
        settings,
        canvasLinkTargets: { assignments: canvasAssignments, quizzes: canvasQuizzes },
        roster,
        module: module(moduleName, type, canvasAssignment),
      });
    }
    if (type === "quiz") {
      const canvasQuiz = canvasQuizzes?.find((q) => q.title === item.name);
      return getSyncStatus({
        item: item as LocalQuiz,
        canvasItem: canvasQuiz,
        type,
        settings,
        canvasQuestions: quizQuestions[item.name],
        module: module(moduleName, type, canvasQuiz),
      });
    }
    const canvasPage = canvasPages?.find((p) => p.title === item.name);
    return getSyncStatus({
      item: item as LocalCoursePage,
      canvasItem: canvasPage,
      type,
      settings,
      module: module(moduleName, type, canvasPage),
    });
  };

  const scheduleStatusOf = (assignment: LocalAssignment, entry: AssignmentScheduleEntry) =>
    getScheduleEntryStatus(
      assignment,
      entry,
      canvasAssignments?.find((c) => c.name === assignment.name),
      roster,
    );

  return { statusOf, scheduleStatusOf };
}
