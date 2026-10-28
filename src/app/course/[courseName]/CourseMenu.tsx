"use client";
import { Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useLocalCoursesSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { getTermName, groupByStartDate } from "@/features/local/utils/timeUtils";
import { getCourseUrl } from "@/services/urlUtils";
import { SectionTitle } from "@/components/SidePane";
import { CaretDownIcon } from "@/components/icons/ActionIcons";

/**
 * Beside the course's crumb: every course by term, newest term first, the
 * current one open, to switch course from any page.
 */
export function CourseMenu({ courseName }: { courseName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative flex items-center">
      <button
        className="unstyled px-1 text-slate-500 hover:text-slate-200"
        aria-label="other courses"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <CaretDownIcon />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-50 mt-1 w-72 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-700 bg-gray-900 shadow-lg shadow-black/50 px-3 py-1 text-sm font-normal">
            <Suspense fallback={null}>
              <CoursesByTerm courseName={courseName} onPick={() => setOpen(false)} />
            </Suspense>
          </div>
        </>
      )}
    </span>
  );
}

function CoursesByTerm({ courseName, onPick }: { courseName: string; onPick: () => void }) {
  const { data: allSettings } = useLocalCoursesSettingsQuery();
  const byStart = groupByStartDate(allSettings);
  const currentTerm = Object.keys(byStart).find((start) =>
    byStart[start].some((c) => c.name === courseName),
  );
  return Object.keys(byStart)
    .sort()
    .reverse()
    .map((start) => (
      <details
        key={start}
        className="group border-b border-slate-800 last:border-b-0"
        open={start === currentTerm}
      >
        <summary className="list-none">
          <SectionTitle title={getTermName(start)} />
        </summary>
        <div className="pb-2 ps-5 flex flex-col">
          {byStart[start].map((course) => (
            <Link
              key={course.name}
              to={getCourseUrl(course.name)}
              onClick={onPick}
              className={
                "py-1 truncate hover:text-white " +
                (course.name === courseName ? "font-bold text-slate-100" : "text-slate-300")
              }
            >
              {course.name}
            </Link>
          ))}
        </div>
      </details>
    ));
}
