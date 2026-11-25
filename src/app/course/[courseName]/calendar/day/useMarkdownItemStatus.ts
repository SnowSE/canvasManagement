"use client";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useCanvasAssignmentsQuery } from "@/features/canvas/hooks/canvasAssignmentHooks";
import { useCanvasPagesQuery } from "@/features/canvas/hooks/canvasPageHooks";
import { useCanvasQuizzesQuery } from "@/features/canvas/hooks/canvasQuizHooks";
import { useRosterGroupSetsQuery, useRosterStudentsQuery } from "@/features/canvas/roster/rosterHooks";
import { useCanvasModulesWithItemsQuery } from "@/features/canvas/hooks/canvasModuleHooks";
import { canvasModuleNames } from "@/features/canvas/services/canvasModuleService";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { useCalendarQuizQuestions } from "../../context/CalendarQuizQuestionsProvider";
import { getSyncStatus, ItemSyncStatus } from "./getAssignmentSyncStatus";

// Each item's last status, with what it was compared from. Comparing an item
// renders its markdown, which is slow, so it's compared again only when one
// of those changed. Kept outside the page so coming back to it costs nothing.
const compared = new Map<string, { deps: unknown[]; status: ItemSyncStatus }>();
export function remembered(key: string, deps: unknown[], compare: () => ItemSyncStatus) {
  const last = compared.get(key);
  if (last && last.deps.every((d, i) => Object.is(d, deps[i]))) return last.status;
  const status = compare();
  compared.set(key, { deps, status });
  return status;
}

/**
 * How an assignment, quiz or page stands against Canvas: found there by
 * name, and compared. Nothing until Canvas has answered.
 */
export function useMarkdownItemStatusOf(type: "assignment" | "quiz" | "page") {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasAssignments } = useCanvasAssignmentsQuery();
  const { data: canvasQuizzes } = useCanvasQuizzesQuery();
  const { data: canvasPages } = useCanvasPagesQuery();
  const { data: rosterStudents } = useRosterStudentsQuery();
  const { data: rosterGroupSets } = useRosterGroupSetsQuery();
  const roster = { students: rosterStudents, groupSets: rosterGroupSets };
  // filled in the background for this week's and the next three weeks' quizzes
  const quizQuestions = useCalendarQuizQuestions();
  const { data: canvasModules, isFetching: modulesRefetching } = useCanvasModulesWithItemsQuery();
  const canvasLinkTargets = { assignments: canvasAssignments, quizzes: canvasQuizzes };
  if (!canvasAssignments || !canvasQuizzes || !canvasPages || !canvasModules) return undefined;

  return (item: IModuleItem, moduleName: string) => {
    const canvasItem =
      type === "assignment"
        ? canvasAssignments.find((c) => c.name === item.name)
        : type === "quiz"
          ? canvasQuizzes.find((q) => q.title === item.name)
          : canvasPages.find((p) => p.title === item.name);
    const canvasQuestions = type === "quiz" ? quizQuestions[item.name] : undefined;
    return remembered(
      `${settings.name}/${type}/${moduleName}/${item.name}`,
      [item, canvasItem, settings, canvasModules, modulesRefetching, rosterStudents, rosterGroupSets, canvasQuestions, canvasAssignments, canvasQuizzes],
      () =>
        getSyncStatus({
          item: item as LocalAssignment | LocalQuiz | LocalCoursePage,
          canvasItem,
          type,
          settings,
          canvasLinkTargets,
          roster,
          canvasQuestions,
          // not compared while the modules are being refetched (an item was just added to one)
          module: canvasItem && !modulesRefetching ? { file: moduleName, canvas: canvasModuleNames(canvasModules, type, canvasItem) } : undefined,
        }),
    );
  };
}
