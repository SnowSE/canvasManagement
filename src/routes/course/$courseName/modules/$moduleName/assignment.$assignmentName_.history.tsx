import { createFileRoute } from "@tanstack/react-router";
import { ShowPaneAndGo } from "@/components/panes/ShowPaneAndGo";
import { getModuleItemUrl } from "@/services/urlUtils";

// history is a pane of the item now; this url from before opens it there
export const Route = createFileRoute("/course/$courseName/modules/$moduleName/assignment/$assignmentName_/history")({
  component: OpenPane,
});

function OpenPane() {
  const { courseName, moduleName, assignmentName } = Route.useParams();
  return <ShowPaneAndGo pane="history" to={getModuleItemUrl(decodeURIComponent(courseName), decodeURIComponent(moduleName), "assignment", decodeURIComponent(assignmentName))} />;
}
