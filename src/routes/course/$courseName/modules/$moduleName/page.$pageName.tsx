import { pageTitle, itemTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";
import { UnparsableItemFallback } from "@/app/course/[courseName]/modules/[moduleName]/unparsable/UnparsableItemFallback";
import EditPage from "@/app/course/[courseName]/modules/[moduleName]/page/[pageName]/EditPage";

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

function PageEditorPage() {
  const { moduleName, pageName } = Route.useParams();
  const decodedPageName = decodeURIComponent(pageName);
  const decodedModuleName = decodeURIComponent(moduleName);
  return (
    <UnparsableItemFallback
      moduleName={decodedModuleName}
      type="Page"
      name={decodedPageName}
    >
      <EditPage pageName={decodedPageName} moduleName={decodedModuleName} />
    </UnparsableItemFallback>
  );
}
