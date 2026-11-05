import { pageTitle, itemTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/page/$pageName",
)({
  head: ({ params }) =>
    titleHead(
      pageTitle({
        thing: itemTitle("Page: ", params.pageName),
        courseName: params.courseName,
      }),
    ),
  component: PageEditorPage,
});

// the frame renders the item's editing from the url (see ItemEditing)
function PageEditorPage() {
  return null;
}
