import { createFileRoute } from "@tanstack/react-router";
import { ShowPaneAndGo } from "@/components/panes/ShowPaneAndGo";
import { getLectureUrl } from "@/services/urlUtils";

// preview is a pane of the lecture now; this url from before opens it there
export const Route = createFileRoute("/course/$courseName/lecture/$lectureDay/preview")({
  component: OpenPane,
});

function OpenPane() {
  const { courseName, lectureDay } = Route.useParams();
  return <ShowPaneAndGo pane="preview" to={getLectureUrl(decodeURIComponent(courseName), decodeURIComponent(lectureDay))} />;
}
