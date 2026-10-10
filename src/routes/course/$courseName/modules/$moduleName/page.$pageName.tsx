import { createFileRoute } from "@tanstack/react-router";
import { UnparsableItemFallback } from "@/app/course/[courseName]/modules/[moduleName]/unparsable/UnparsableItemFallback";
import EditPage from "@/app/course/[courseName]/modules/[moduleName]/page/[pageName]/EditPage";

export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/page/$pageName",
)({
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
