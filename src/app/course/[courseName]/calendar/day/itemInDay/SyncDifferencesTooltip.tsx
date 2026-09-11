"use client";
import { FC, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { getCompareUrl } from "@/services/urlUtils";
import { useCourseContext } from "../../../context/courseContext";
import { SyncField } from "../getAssignmentSyncStatus";

const MAX_LISTED = 5;

/**
 * Tooltip body for a calendar item that is out of sync with Canvas: every
 * difference, plus a link to the compare page for assignments and quizzes.
 */
export const SyncDifferencesTooltip: FC<{
  type: "assignment" | "page" | "quiz";
  moduleName: string;
  itemName: string;
  status: "localOnly" | "incomplete" | "published";
  message: ReactNode;
  differences: SyncField[];
}> = ({ type, moduleName, itemName, status, message, differences }) => {
  const { courseName } = useCourseContext();
  if (status !== "incomplete" || differences.length === 0)
    return <>{message}</>;

  const canCompare = type === "assignment" || type === "quiz";
  // the tooltip has a fixed max height; keep the compare link in view
  const shown = differences.slice(0, MAX_LISTED);
  const hidden = differences.length - shown.length;
  return (
    <div className="max-w-md text-start">
      <div className="flex justify-between gap-3">
        <span className="font-bold">{itemName}</span>
        <span className="text-rose-300 text-xs self-center whitespace-nowrap">
          {differences.length} difference{differences.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="list-disc ps-5 text-rose-300">
        {shown.map((d) => (
          <li key={d.key}>{d.message}</li>
        ))}
      </ul>
      {hidden > 0 && (
        <div className="text-slate-400 ps-5">
          and {hidden} more on the compare page
        </div>
      )}
      {canCompare && (
        <div className="border-t border-slate-700 mt-2 pt-1 flex justify-between gap-3 text-xs">
          <Link
            to={getCompareUrl(courseName, moduleName, type, itemName)}
            className="text-blue-300 hover:underline"
          >
            Compare with Canvas →
          </Link>
          <span className="text-slate-500">right-click for more</span>
        </div>
      )}
    </div>
  );
};
