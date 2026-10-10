"use client";
import { Link, useLocation } from "@tanstack/react-router";
import { useErrorLogQuery } from "@/features/local/errorLog/errorLogHooks";

/** Bottom-center count of this session's unfixed errors; opens the error list. */
export function ErrorLogPill() {
  const { data } = useErrorLogQuery();
  const { pathname } = useLocation();
  const count = data?.entries.filter((e) => !e.resolved).length ?? 0;
  if (count === 0 || pathname === "/errors") return null;

  return (
    <Link
      to="/errors"
      className="
        fixed bottom-2 left-1/2 -translate-x-1/2 z-40
        flex items-center gap-2 rounded-full px-3 py-1
        bg-rose-950/90 border border-rose-700 text-rose-100 text-sm font-semibold
        shadow-lg hover:bg-rose-900
      "
      title="Errors since the app started. Click to see them."
    >
      <span aria-hidden>⚠</span>
      {count} {count === 1 ? "error" : "errors"}
    </Link>
  );
}
