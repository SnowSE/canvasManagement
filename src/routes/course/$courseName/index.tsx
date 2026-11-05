import { pageTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/course/$courseName/")({
  head: ({ params }) => titleHead(pageTitle({ courseName: params.courseName })),
  component: CoursePage,
});

// the course page is the frame's panes, the calendar filling it; nothing of its own
function CoursePage() {
  return null;
}
