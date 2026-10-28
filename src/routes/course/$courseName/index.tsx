import { pageTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";
import CourseCalendar from "@/app/course/[courseName]/calendar/CourseCalendar";
import { CourseNavigation } from "@/app/course/[courseName]/CourseNavigation";
import { CoursePageLayout } from "@/app/course/[courseName]/CoursePageLayout";

export const Route = createFileRoute("/course/$courseName/")({
  head: ({ params }) => titleHead(pageTitle({ courseName: params.courseName })),
  component: CoursePage,
});

function CoursePage() {
  return (
    <CoursePageLayout topBar={<CourseNavigation />}>
      <CourseCalendar />
    </CoursePageLayout>
  );
}
