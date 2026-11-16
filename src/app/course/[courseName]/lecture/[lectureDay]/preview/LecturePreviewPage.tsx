"use client";

import { Link } from "@tanstack/react-router";
import LecturePreview from "../LecturePreview";
import EditLectureTitle from "../EditLectureTitle";
import { useLecturesSuspenseQuery } from "@/features/local/lectures/lectureHooks";
import { CoursePageLayout } from "@/app/course/[courseName]/CoursePageLayout";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { getLectureUrl } from "@/services/urlUtils";

export default function LecturePreviewPage({
  lectureDay,
}: {
  lectureDay: string;
}) {
  const { courseName } = useCourseContext();
  const { data: weeks } = useLecturesSuspenseQuery();
  const lecture = weeks
    .flatMap(({ lectures }) => lectures.map((lecture) => lecture))
    .find((l) => l.date === lectureDay);

  // The same top bar as the editor, with "edit" where "preview" was: it stays
  // put while the lecture scrolls, so the split view is always one click away.
  const topBar = (
    <>
      <div className="min-w-0 flex-auto">
        <EditLectureTitle lectureDay={lectureDay} />
      </div>
      <div className="flex-none ms-auto px-1">
        <Link
          className="btn inline text-center flex-grow m-1"
          to={getLectureUrl(courseName, lectureDay)}
        >
          edit
        </Link>
      </div>
    </>
  );

  return (
    <CoursePageLayout topBar={topBar}>
      {lecture ? (
        <div className="flex min-h-0 flex-1 justify-center px-2 pb-1">
          <div className="w-full max-w-screen-lg overflow-auto rounded-md border-4 border-slate-700 bg-gray-900/50 p-3">
            <LecturePreview lecture={lecture} />
          </div>
        </div>
      ) : (
        <div>lecture not found for day</div>
      )}
    </CoursePageLayout>
  );
}
