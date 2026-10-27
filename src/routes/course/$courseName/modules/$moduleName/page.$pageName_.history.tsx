import { pageTitle, itemTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";
import ClientOnly from "@/components/ClientOnly";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import { ItemHistory } from "@/app/course/[courseName]/modules/[moduleName]/history/ItemHistory";

// `$pageName_` keeps this page out of the editor's layout while sharing its url prefix.
export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/page/$pageName_/history",
)({
  head: ({ params }) =>
    titleHead(
      pageTitle({
        thing: itemTitle("History: ", params.pageName),
        courseName: params.courseName,
        withAppName: false,
      }),
    ),
  component: PageHistoryPage,
});

function PageHistoryPage() {
  const { moduleName, pageName } = Route.useParams();
  return (
    <ClientOnly>
      <SuspenseAndErrorHandling>
        <ItemHistory
          moduleName={decodeURIComponent(moduleName)}
          type="Page"
          name={decodeURIComponent(pageName)}
        />
      </SuspenseAndErrorHandling>
    </ClientOnly>
  );
}
