"use client";
import { Spinner } from "@/components/Spinner";
import { useReloadCanvasData } from "@/features/canvas/hooks/useReloadCanvasData";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import {
  CloseMenuOnClick,
  MobileActionsMenu,
} from "@/components/MobileActionsMenu";
import ClientOnly from "@/components/ClientOnly";
import { GitStatusButton } from "./git/GitStatusButton";

export function CourseNavigation() {
  const { data: settings } = useLocalCourseSettingsQuery();

  const { reload, fetching } = useReloadCanvasData();

  const viewInCanvasLink = (
    <a
      href={`https://snow.instructure.com/courses/${settings.canvasId}`}
      className="btn"
      target="_blank"
    >
      View course in Canvas
    </a>
  );

  const reloadControl = fetching ? (
    <div className="flex flex-row">
      <Spinner />
      <div className="ps-1">loading canvas data</div>
    </div>
  ) : (
    <button className="unstyled btn-outline" onClick={reload}>
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
