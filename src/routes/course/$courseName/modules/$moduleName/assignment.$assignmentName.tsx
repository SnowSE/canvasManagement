import { pageTitle, itemTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/assignment/$assignmentName",
)({
  head: ({ params }) =>
    titleHead(
      pageTitle({
        thing: itemTitle("", params.assignmentName),
        courseName: params.courseName,
      }),
    ),
  component: AssignmentPage,
});

// the frame renders the item's editing from the url (see ItemEditing)
function AssignmentPage() {
  return null;
}
