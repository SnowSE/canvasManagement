import { createFileRoute } from "@tanstack/react-router";
import { ShowPaneAndGo } from "@/components/panes/ShowPaneAndGo";
import { getModuleItemUrl } from "@/services/urlUtils";

// compare is a pane of the item now; this url from before opens it there
export const Route = createFileRoute("/course/$courseName/modules/$moduleName/page/$pageName_/compare")({
  component: OpenPane,
});

function OpenPane() {
  const { courseName, moduleName, pageName } = Route.useParams();
  return <ShowPaneAndGo pane="compare" to={getModuleItemUrl(decodeURIComponent(courseName), decodeURIComponent(moduleName), "page", decodeURIComponent(pageName))} />;
}
