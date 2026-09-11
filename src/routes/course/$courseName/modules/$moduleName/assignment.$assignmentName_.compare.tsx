import { createFileRoute } from "@tanstack/react-router";
import ClientOnly from "@/components/ClientOnly";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import { CompareAssignmentWithCanvas } from "@/app/course/[courseName]/modules/[moduleName]/compare/CompareWithCanvas";

// `$assignmentName_` keeps this page out of the assignment editor's layout
// while sharing its url prefix.
export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/assignment/$assignmentName_/compare",
)({
  component: CompareAssignmentPage,
});

function CompareAssignmentPage() {
  const { moduleName, assignmentName } = Route.useParams();
  return (
    <ClientOnly>
      <SuspenseAndErrorHandling>
        <CompareAssignmentWithCanvas
          moduleName={decodeURIComponent(moduleName)}
          assignmentName={decodeURIComponent(assignmentName)}
        />
      </SuspenseAndErrorHandling>
    </ClientOnly>
  );
}
