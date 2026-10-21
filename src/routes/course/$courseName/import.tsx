import { createFileRoute, Link } from "@tanstack/react-router";
import ImportFromCanvas from "@/app/course/[courseName]/import/ImportFromCanvas";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { getCourseUrl } from "@/services/urlUtils";

export const Route = createFileRoute("/course/$courseName/import")({
  component: ImportPage,
});

function ImportPage() {
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  return (
    <div className="flex justify-center h-full overflow-auto pt-5">
      <div className="w-full max-w-7xl min-w-0 px-3 pb-12">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link className="btn whitespace-nowrap" to={getCourseUrl(courseName)}>
            Back To Course
          </Link>
          <h3 className="text-center mb-3">
            {settings.name}{" "}
            <span className="text-slate-500 text-xl"> import from Canvas</span>
          </h3>
          <div className="hidden sm:block"></div>
        </div>
        <hr />
        <ImportFromCanvas />
      </div>
    </div>
  );
}
