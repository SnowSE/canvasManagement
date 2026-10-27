import { pageTitle, itemTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";
import { UnparsableItemFallback } from "@/app/course/[courseName]/modules/[moduleName]/unparsable/UnparsableItemFallback";
import EditAssignment from "@/app/course/[courseName]/modules/[moduleName]/assignment/[assignmentName]/EditAssignment";

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

function AssignmentPage() {
  const { moduleName, assignmentName } = Route.useParams();
  const decodedAssignmentName = decodeURIComponent(assignmentName);
  const decodedModuleName = decodeURIComponent(moduleName);
  return (
    <UnparsableItemFallback
      moduleName={decodedModuleName}
      type="Assignment"
      name={decodedAssignmentName}
    >
      <EditAssignment
        assignmentName={decodedAssignmentName}
        moduleName={decodedModuleName}
      />
    </UnparsableItemFallback>
  );
}
