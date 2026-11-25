import { pageTitle, itemTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/file/$fileName",
)({
  head: ({ params }) =>
    titleHead(
      pageTitle({
        thing: itemTitle("File: ", params.fileName),
        courseName: params.courseName,
      }),
    ),
  component: FileEditorPage,
});

// the frame renders the item's editing from the url (see ItemEditing)
function FileEditorPage() {
  return null;
}
