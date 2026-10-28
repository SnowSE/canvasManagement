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
import { Link } from "@tanstack/react-router";
import {
  CloseMenuOnClick,
  MobileActionsMenu,
} from "@/components/MobileActionsMenu";
import { getCourseImportUrl, getCourseSettingsUrl } from "@/services/urlUtils";
import { useCourseContext } from "./context/courseContext";
import ClientOnly from "@/components/ClientOnly";
import { GitStatusButton } from "./git/GitStatusButton";
import { getTermName } from "@/features/local/utils/timeUtils";

export function CourseNavigation() {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { courseName } = useCourseContext();

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
      View in Canvas
    </a>
  );

  // "Import" on the crowded desktop bar, next to View in Canvas
  const importLink = (label: string) => (
    <Link
      className="btn"
      to={getCourseImportUrl(courseName)}
      title="Import from Canvas: bring in assignments, quizzes and pages that are in Canvas but have no file here"
    >
      {label}
    </Link>
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
        {importLink("Import")}
        {reloadControl}
        <ClientOnly>
          <GitStatusButton />
        </ClientOnly>
        <Link className="btn" to={getCourseSettingsUrl(courseName)}>
          Course Settings
        </Link>
        {settings?.startDate && (
          <div className="my-auto text-slate-500">
            {getTermName(settings.startDate)}
          </div>
        )}
      </div>
      <MobileActionsMenu>
        <CloseMenuOnClick>{viewInCanvasLink}</CloseMenuOnClick>
        <CloseMenuOnClick>{importLink("Import From Canvas")}</CloseMenuOnClick>
        {reloadControl}
        <ClientOnly>
          <GitStatusButton />
        </ClientOnly>
        <CloseMenuOnClick>
          <Link className="btn" to={getCourseSettingsUrl(courseName)}>
            Course Settings
          </Link>
        </CloseMenuOnClick>
        {settings?.startDate && (
          <div className="px-3 pt-2 text-sm text-slate-500">
            {getTermName(settings.startDate)}
          </div>
        )}
      </MobileActionsMenu>
    </>
  );
}
