"use client";
import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { diffLines } from "diff";
import { BreadCrumbs } from "@/components/BreadCrumbs";
import { RightSingleChevron } from "@/components/icons/RightSingleChevron";
import { Spinner } from "@/components/Spinner";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { CourseItemType } from "@/features/local/course/courseItemTypes";
import { useRawItemQuery } from "@/features/local/modules/rawItemHooks";
import {
  useItemAtCommitQuery,
  useItemHistoryQuery,
  useRestoreItemMutation,
} from "@/features/local/git/gitHooks";
import { getCourseUrl, getModuleItemUrl } from "@/services/urlUtils";
import { getErrorMessage } from "@/services/utils/queryClient";

const urlType = { Assignment: "assignment", Quiz: "quiz", Page: "page" } as const;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Every committed version of one item's file, with a diff against now and a restore. */
export function ItemHistory({
  moduleName,
  type,
  name,
}: {
  moduleName: string;
  type: CourseItemType;
  name: string;
}) {
  const { courseName } = useCourseContext();
  const router = useRouter();
  const item = { moduleName, type, name };
  const { data: history, isLoading } = useItemHistoryQuery(item);
  const { data: current } = useRawItemQuery(moduleName, type, name);
  const [selectedSha, setSelectedSha] = useState<string>();
  const selected =
    history?.commits.find((c) => c.sha === selectedSha) ?? history?.commits[0];
  const { data: oldText, isFetching } = useItemAtCommitQuery(
    item,
    selected && { sha: selected.sha, path: selected.path },
  );
  const restore = useRestoreItemMutation();
  const editUrl = getModuleItemUrl(courseName, moduleName, urlType[type], name);

  const onRestore = () => {
    if (!selected) return;
    const warning = history?.uncommittedChanges
      ? "The file has changes that were never committed. Restoring replaces them and they cannot be got back. Commit first if you might want them.\n\n"
      : "";
    if (
      !window.confirm(
        `${warning}Replace the file with the version from ${formatDate(selected.date)} ("${selected.subject}")?`,
      )
    )
      return;
    restore.mutate(
      { courseName, ...item, sha: selected.sha, path: selected.path },
      { onSuccess: () => router.navigate({ to: editUrl }) },
    );
  };

  return (
    <div className="h-full flex flex-col max-w-[1400px] mx-auto bg-gray-900 rounded">
      <div className="py-1 px-1 flex flex-row items-center min-w-0 flex-none">
        <BreadCrumbs />
        <Chevron />
        <Link
          to={editUrl}
          className="truncate text-slate-300 hover:text-slate-100 px-2 text-sm font-bold"
        >
          {name}
        </Link>
        <Chevron />
        <span className="px-2 text-sm font-bold text-slate-100 whitespace-nowrap">
          File history
        </span>
      </div>

      <div className="min-h-0 flex-1 flex flex-col md:flex-row gap-4 px-3 sm:px-5 pt-3">
        <div className="md:w-80 flex-none md:overflow-y-auto">
          <div className="text-sm uppercase tracking-wider text-slate-400 font-semibold pb-2">
            Committed versions
          </div>
          {isLoading && <Spinner />}
          {history && history.commits.length === 0 && (
            <div className="text-slate-400 text-sm">
              This file has never been committed. Commit from the course
              page&rsquo;s git button to start its history.
            </div>
          )}
          {history?.uncommittedChanges && (
            <div className="text-amber-300 text-sm pb-2">
              The file has uncommitted changes.
            </div>
          )}
          <ul className="flex flex-col gap-1 !list-none !ps-0">
            {history?.commits.map((commit) => (
              <li key={commit.sha}>
                <button
                  className={
                    "unstyled w-full text-left rounded px-2 py-1 font-normal " +
                    (commit.sha === selected?.sha
                      ? "bg-blue-900/60 text-slate-100"
                      : "hover:bg-slate-800 text-slate-300")
                  }
                  onClick={() => setSelectedSha(commit.sha)}
                >
                  <div className="text-sm font-semibold truncate">{commit.subject}</div>
                  <div className="text-xs text-slate-400">
                    {formatDate(commit.date)} · {commit.author} · {commit.shortSha}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto pb-4">
          {selected && (
            <>
              <div className="text-sm uppercase tracking-wider text-slate-400 font-semibold pb-2">
                From this version to the file now
              </div>
              <div className="text-xs text-slate-400 pb-2">
                <span className="text-rose-300">Red</span> is only in the{" "}
                {formatDate(selected.date)} version,{" "}
                <span className="text-green-300">green</span> was added since.
              </div>
              {isFetching || current === undefined || oldText === undefined ? (
                <Spinner />
              ) : (
                <TextDiff oldText={oldText} newText={current.text} />
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-none border-t border-slate-700 bg-gray-900/95 px-3 sm:px-5 py-3 flex flex-row flex-wrap justify-between items-center gap-3">
        <div className="text-sm text-slate-400 max-w-sm">
          Restoring writes the selected version over the file. Nothing is
          committed until you commit.
          {restore.isError && (
            <div className="text-amber-300">{getErrorMessage(restore.error)}</div>
          )}
        </div>
        <div className="flex flex-row flex-wrap gap-3 justify-end items-center">
          {restore.isPending && <Spinner />}
          <button
            className="btn-outline"
            onClick={() => {
              if (window.history.length > 1) router.history.back();
              else router.navigate({ to: getCourseUrl(courseName) });
            }}
          >
            Back
          </button>
          <Link className="btn" to={editUrl}>
            Edit file
          </Link>
          <button
            className="disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selected || restore.isPending || oldText === current?.text}
            title={oldText === current?.text ? "The file already matches this version" : undefined}
            onClick={onRestore}
          >
            Restore this version
          </button>
        </div>
      </div>
    </div>
  );
}

const Chevron = () => (
  <span className="text-slate-500 cursor-default select-none my-auto">
    <RightSingleChevron />
  </span>
);

type DiffRow =
  | { kind: "same" | "added" | "removed"; text: string }
  | { kind: "skipped"; count: number };

// unchanged lines kept around each change
const context = 3;

function TextDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const rows = useMemo(() => {
    const lines: DiffRow[] = diffLines(oldText, newText).flatMap((change) =>
      change.value
        .replace(/\n$/, "")
        .split("\n")
        .map((text) => ({
          kind: change.added ? "added" : change.removed ? "removed" : "same",
          text,
        })) as DiffRow[],
    );
    const keep = lines.map(() => false);
    lines.forEach((line, i) => {
      if (line.kind === "same") return;
      for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++)
        keep[j] = true;
    });
    const collapsed: DiffRow[] = [];
    let skipped = 0;
    lines.forEach((line, i) => {
      if (keep[i]) {
        if (skipped) collapsed.push({ kind: "skipped", count: skipped });
        skipped = 0;
        collapsed.push(line);
      } else skipped++;
    });
    if (skipped) collapsed.push({ kind: "skipped", count: skipped });
    return collapsed;
  }, [oldText, newText]);

  if (oldText === newText)
    return <div className="text-slate-400 py-6">The file is the same as this version.</div>;

  return (
    <pre className="text-sm font-mono bg-gray-950/60 rounded p-2 overflow-x-auto">
      {rows.map((row, i) =>
        row.kind === "skipped" ? (
          <div key={i} className="text-slate-500 italic py-0.5">
            ⋯ {row.count} unchanged line{row.count === 1 ? "" : "s"}
          </div>
        ) : (
          <div
            key={i}
            className={
              row.kind === "added"
                ? "bg-green-900/40 text-green-200"
                : row.kind === "removed"
                  ? "bg-rose-900/40 text-rose-200"
                  : "text-slate-400"
            }
          >
            <span className="select-none inline-block w-4 text-slate-500">
              {row.kind === "added" ? "+" : row.kind === "removed" ? "-" : " "}
            </span>
            {row.text || " "}
          </div>
        ),
      )}
    </pre>
  );
}
