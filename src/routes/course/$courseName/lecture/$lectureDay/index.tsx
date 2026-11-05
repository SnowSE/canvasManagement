import { pageTitle, lectureTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/course/$courseName/lecture/$lectureDay/",
)({
  head: ({ params }) =>
    titleHead(
      pageTitle({
        thing: lectureTitle(params.lectureDay),
        courseName: params.courseName,
      }),
    ),
  component: LecturePage,
});

// the frame renders the lecture's editing from the url (see ItemEditing)
function LecturePage() {
  return null;
}
