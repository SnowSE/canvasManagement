import { createFileRoute } from "@tanstack/react-router";
import ClientOnly from "@/components/ClientOnly";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import { ComparePageWithCanvas } from "@/app/course/[courseName]/modules/[moduleName]/compare/CompareWithCanvas";

// `$pageName_` keeps this page out of the page editor's layout while sharing
// its url prefix.
export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/page/$pageName_/compare",
)({
  component: ComparePagePage,
});

function ComparePagePage() {
  const { moduleName, pageName } = Route.useParams();
  return (
    <ClientOnly>
      <SuspenseAndErrorHandling>
        <ComparePageWithCanvas
          moduleName={decodeURIComponent(moduleName)}
          pageName={decodeURIComponent(pageName)}
        />
      </SuspenseAndErrorHandling>
    </ClientOnly>
  );
}
