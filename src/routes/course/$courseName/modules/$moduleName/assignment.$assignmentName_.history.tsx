import { createFileRoute } from "@tanstack/react-router";
import ClientOnly from "@/components/ClientOnly";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import { ItemHistory } from "@/app/course/[courseName]/modules/[moduleName]/history/ItemHistory";

// `$assignmentName_` keeps this page out of the editor's layout while sharing its url prefix.
export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/assignment/$assignmentName_/history",
)({
  component: AssignmentHistoryPage,
});

function AssignmentHistoryPage() {
  const { moduleName, assignmentName } = Route.useParams();
  return (
    <ClientOnly>
      <SuspenseAndErrorHandling>
        <ItemHistory
          moduleName={decodeURIComponent(moduleName)}
          type="Assignment"
          name={decodeURIComponent(assignmentName)}
        />
      </SuspenseAndErrorHandling>
    </ClientOnly>
  );
}
