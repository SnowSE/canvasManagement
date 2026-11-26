import { canvasFileKeys } from "./canvasCourseFileHooks";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { canvasAssignmentKeys, useCanvasAssignmentsQuery } from "./canvasAssignmentHooks";
import { canvasCourseKeys } from "./canvasCourseHooks";
import { canvasCourseModuleKeys, useCanvasModulesQuery } from "./canvasModuleHooks";
import { canvasPageKeys, useCanvasPagesQuery } from "./canvasPageHooks";
import { canvasQuizKeys, useCanvasQuizzesQuery } from "./canvasQuizHooks";
import { requestCheckAll } from "./checkedQuizzes";

/**
 * Reload Canvas Data: reads the course's Canvas lists again now, for a change
 * made in Canvas itself, and checks every quiz's questions (see checkedQuizzes). The app otherwise reads them about once an hour and
 * after its own changes (see the query defaults in providersQueryClientUtils).
 * `fetching` is true while any of the lists is being read.
 */
export const useReloadCanvasData = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const lists = [
    useCanvasAssignmentsQuery(),
    useCanvasModulesQuery(),
    useCanvasPagesQuery(),
    useCanvasQuizzesQuery(),
  ];
  const reload = () => {
    for (const queryKey of [
      canvasAssignmentKeys.assignments(settings.canvasId),
      canvasCourseKeys.assignmentGroups(settings.canvasId),
      canvasCourseModuleKeys.modules(settings.canvasId),
      canvasPageKeys.pagesInCourse(settings.canvasId),
      canvasQuizKeys.quizzes(settings.canvasId),
      canvasFileKeys.files(settings.canvasId),
    ])
      queryClient.invalidateQueries({ queryKey });
    // a change made in Canvas could be in any quiz's questions: check them all, not just the calendar's four weeks
    requestCheckAll(settings.canvasId);
  };
  return { reload, fetching: lists.some((q) => q.isFetching) };
};
