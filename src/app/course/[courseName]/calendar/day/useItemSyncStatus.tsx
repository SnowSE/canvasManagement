"use client";
import { createContext, ReactNode, useContext } from "react";
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
import {
  LocalAssignment,
  AssignmentScheduleEntry,
} from "@/features/local/assignments/models/localAssignment";
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
function useSyncStatuses() {
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
  const canvasLinkTargets = { assignments: canvasAssignments, quizzes: canvasQuizzes };

  const statusOf = (type: ItemType, item: IModuleItem, moduleName: string) => {
    const canvasItem =
      type === "assignment"
        ? canvasAssignments?.find((c) => c.name === item.name)
        : type === "quiz"
          ? canvasQuizzes?.find((q) => q.title === item.name)
          : canvasPages?.find((p) => p.title === item.name);
    const canvasQuestions = type === "quiz" ? quizQuestions[item.name] : undefined;
    return getSyncStatus({
          item: item as LocalAssignment | LocalQuiz | LocalCoursePage,
          canvasItem,
          type,
          settings,
          canvasLinkTargets,
          roster,
          canvasQuestions,
          module: canvasModules && canvasItem && { file: moduleName, canvas: canvasModuleNames(canvasModules, type, canvasItem) },
    });
  };

  const scheduleStatusOf = (assignment: LocalAssignment, entry: AssignmentScheduleEntry) => {
    const canvasAssignment = canvasAssignments?.find((c) => c.name === assignment.name);
    return getScheduleEntryStatus(assignment, entry, canvasAssignment, roster);
  };

  return { statusOf, scheduleStatusOf };
}

const SyncStatusContext = createContext<ReturnType<typeof useSyncStatuses> | undefined>(undefined);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  return <SyncStatusContext.Provider value={useSyncStatuses()}>{children}</SyncStatusContext.Provider>;
}

export function useItemSyncStatus() {
  const statuses = useContext(SyncStatusContext);
  if (!statuses) throw new Error("useItemSyncStatus needs a SyncStatusProvider");
  return statuses;
}
