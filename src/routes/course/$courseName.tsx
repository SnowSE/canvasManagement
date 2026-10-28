import { createFileRoute, Outlet } from "@tanstack/react-router";
import CourseContextProvider from "@/app/course/[courseName]/context/CourseContextProvider";
import { Suspense } from "react";
import DraggingContextProvider from "@/app/course/[courseName]/context/drag/DraggingContextProvider";
import { DragStyleContextProvider } from "@/app/course/[courseName]/context/drag/dragStyleContext";
import CalendarItemsContextProvider from "@/app/course/[courseName]/context/CalendarItemsContextProvider";
import { SyncStatusProvider } from "@/app/course/[courseName]/calendar/day/useItemSyncStatus";
import CalendarQuizQuestionsProvider from "@/app/course/[courseName]/context/CalendarQuizQuestionsProvider";
import { CourseFrame } from "@/app/course/[courseName]/CoursePageLayout";

export const Route = createFileRoute("/course/$courseName")({
  component: CourseLayout,
});

function CourseLayout() {
  const { courseName } = Route.useParams();
  const decodedCourseName = decodeURIComponent(courseName);
  if (courseName.includes(".js.map")) {
    return <div></div>;
  }
  return (
    <Suspense>
      <CourseContextProvider localCourseName={decodedCourseName}>
        {/* the calendar, the module list and an item's editor show the same
            items with the same status against Canvas; held here so the
            statuses, drags and panes carry over from page to page */}
        <DragStyleContextProvider>
          <DraggingContextProvider>
            <CalendarItemsContextProvider>
              <CalendarQuizQuestionsProvider>
                <SyncStatusProvider>
                  <CourseFrame>
                    <Outlet />
                  </CourseFrame>
                </SyncStatusProvider>
              </CalendarQuizQuestionsProvider>
            </CalendarItemsContextProvider>
          </DraggingContextProvider>
        </DragStyleContextProvider>
      </CourseContextProvider>
    </Suspense>
  );
}
