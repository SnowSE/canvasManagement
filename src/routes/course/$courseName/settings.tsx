import { createFileRoute } from "@tanstack/react-router";
import { ShowPaneAndGo } from "@/components/panes/ShowPaneAndGo";
import { getCourseUrl } from "@/services/urlUtils";

// settings is a pane of the course now; this url from before opens it there
export const Route = createFileRoute("/course/$courseName/settings")({
  component: OpenPane,
});

function OpenPane() {
  const { courseName } = Route.useParams();
  return <ShowPaneAndGo pane="settings" to={getCourseUrl(decodeURIComponent(courseName))} />;
}
