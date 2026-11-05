import { createFileRoute } from "@tanstack/react-router";
import { ShowPaneAndGo } from "@/components/panes/ShowPaneAndGo";
import { getCourseUrl } from "@/services/urlUtils";

// import is a pane of the course now; this url from before opens it there
export const Route = createFileRoute("/course/$courseName/import")({
  component: OpenPane,
});

function OpenPane() {
  const { courseName } = Route.useParams();
  return <ShowPaneAndGo pane="import" to={getCourseUrl(decodeURIComponent(courseName))} />;
}
