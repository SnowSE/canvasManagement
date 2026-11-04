"use client";
import { Spinner } from "@/components/Spinner";
import {
  useCanvasAssignmentsQuery,
  canvasAssignmentKeys,
} from "@/features/canvas/hooks/canvasAssignmentHooks";
import { canvasCourseKeys } from "@/features/canvas/hooks/canvasCourseHooks";
import {
  useCanvasModulesQuery,
  canvasCourseModuleKeys,
} from "@/features/canvas/hooks/canvasModuleHooks";
import {
  useCanvasPagesQuery,
  canvasPageKeys,
} from "@/features/canvas/hooks/canvasPageHooks";
import {
  useCanvasQuizzesQuery,
  canvasQuizKeys,
} from "@/features/canvas/hooks/canvasQuizHooks";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useQueryClient } from "@tanstack/react-query";
import {
  CloseMenuOnClick,
  MobileActionsMenu,
} from "@/components/MobileActionsMenu";
import ClientOnly from "@/components/ClientOnly";
import { GitStatusButton } from "./git/GitStatusButton";

export function CourseNavigation() {
  const { data: settings } = useLocalCourseSettingsQuery();

  const queryClient = useQueryClient();
  const canvasAssignmentsQuery = useCanvasAssignmentsQuery();
  const canvasAssignmentGroupsQuery = useCanvasAssignmentsQuery();
  const canvasModulesQuery = useCanvasModulesQuery();
  const canvasPagesQuery = useCanvasPagesQuery();
  const canvasQuizzesQuery = useCanvasQuizzesQuery();

  const isFetching =
    canvasAssignmentsQuery.isFetching ||
    canvasAssignmentGroupsQuery.isFetching ||
    canvasModulesQuery.isFetching ||
    canvasPagesQuery.isFetching ||
    canvasQuizzesQuery.isFetching;

  const reloadCanvasData = () => {
    queryClient.invalidateQueries({
      queryKey: canvasAssignmentKeys.assignments(settings.canvasId),
    });
    queryClient.invalidateQueries({
      queryKey: canvasCourseKeys.assignmentGroups(settings.canvasId),
    });
    queryClient.invalidateQueries({
      queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
    });
    queryClient.invalidateQueries({
      queryKey: canvasPageKeys.pagesInCourse(settings.canvasId),
    });
    queryClient.invalidateQueries({
      queryKey: canvasQuizKeys.quizzes(settings.canvasId),
    });
  };

  const viewInCanvasLink = (
    <a
      href={`https://snow.instructure.com/courses/${settings.canvasId}`}
      className="btn"
      target="_blank"
    >
      View course in Canvas
    </a>
  );

  const reloadControl = isFetching ? (
    <div className="flex flex-row">
      <Spinner />
      <div className="ps-1">loading canvas data</div>
    </div>
  ) : (
    <button className="unstyled btn-outline" onClick={reloadCanvasData}>
      Reload Canvas Data
    </button>
  );

  return (
    <>
      <div className="max-md:hidden flex flex-row items-center gap-3">
        {viewInCanvasLink}
        {reloadControl}
        <ClientOnly>
          <GitStatusButton />
        </ClientOnly>
      </div>
      <MobileActionsMenu>
        <CloseMenuOnClick>{viewInCanvasLink}</CloseMenuOnClick>
        {reloadControl}
        <ClientOnly>
          <GitStatusButton />
        </ClientOnly>
      </MobileActionsMenu>
    </>
  );
}
