"use client";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Spinner } from "@/components/Spinner";
import { useCourseContext } from "../context/courseContext";
import { ItemTypeIcon } from "../ItemTypeIcon";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useModuleNamesQuery } from "@/features/local/modules/localCourseModuleHooks";
import { useCanvasAssignmentsQuery } from "@/features/canvas/hooks/canvasAssignmentHooks";
import { useCanvasQuizzesQuery } from "@/features/canvas/hooks/canvasQuizHooks";
import { useCanvasPagesQuery } from "@/features/canvas/hooks/canvasPageHooks";
import { useCanvasModulesWithItemsQuery } from "@/features/canvas/hooks/canvasModuleHooks";
import { useAssignmentGroupsQuery } from "@/features/canvas/hooks/canvasCourseHooks";
import {
  fallbackDateFor,
  findImportCandidates,
  ImportCandidate,
  ImportItemType,
} from "@/features/canvas/import/canvasImport";
import { getDateFromString } from "@/features/local/utils/timeUtils";
import { validateFileName } from "@/services/fileNameValidation";
import { getCourseUrl, getModuleItemUrl } from "@/services/urlUtils";
import { ImportResult, useCanvasImport, useLocalItemNames } from "./useCanvasImport";

type SortKey = "type" | "name" | "module" | "dueAt" | "points" | "group" | "published";
type StatusFilter = "all" | "published" | "unpublished";
const NOT_IN_A_MODULE = "\u0000none";
// the global select style is full width
const selectClass = "!w-auto !inline-block !py-1";

const typeLabels: Record<ImportItemType, string> = {
  assignment: "Assignments",
  quiz: "Quizzes",
  page: "Pages",
};

const formatDate = (value?: string) => {
  const date = value ? getDateFromString(value) : undefined;
  return date
    ? date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
};

const emptyNames = { assignment: new Set<string>(), quiz: new Set<string>(), page: new Set<string>() };

/**
 * Everything in Canvas that has no file here, as a table to filter, sort and
 * check, and the import that writes a file for each checked item.
 */
export default function ImportFromCanvas() {
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: moduleNames } = useModuleNamesQuery();
  const assignmentsQuery = useCanvasAssignmentsQuery();
  const quizzesQuery = useCanvasQuizzesQuery();
  const pagesQuery = useCanvasPagesQuery();
  const modulesQuery = useCanvasModulesWithItemsQuery();
  const groupsQuery = useAssignmentGroupsQuery(settings.canvasId);
  const localNames = useLocalItemNames();

  const queries = [assignmentsQuery, quizzesQuery, pagesQuery, modulesQuery, groupsQuery];
  const canvasError = queries.find((q) => q.error)?.error;
  const canvas =
    assignmentsQuery.data && quizzesQuery.data && pagesQuery.data && modulesQuery.data && groupsQuery.data
      ? {
          canvasAssignments: assignmentsQuery.data,
          canvasQuizzes: quizzesQuery.data,
          canvasPages: pagesQuery.data,
          canvasModules: modulesQuery.data,
        }
      : undefined;

  // every Canvas item, imported or not, for dating the ones with no due date
  const everyCanvasItem = canvas
    ? findImportCandidates({ ...canvas, localNames: emptyNames })
    : [];
  const candidates =
    canvas && localNames ? findImportCandidates({ ...canvas, localNames }) : undefined;

  const groupName = (id?: number) =>
    id === undefined ? "" : (groupsQuery.data?.find((g) => g.id === id)?.name ?? "");

  const importer = useCanvasImport({
    canvasAssignments: canvas?.canvasAssignments ?? [],
    canvasQuizzes: canvas?.canvasQuizzes ?? [],
    canvasPages: canvas?.canvasPages ?? [],
    canvasAssignmentGroups: groupsQuery.data ?? [],
    fallbackDateFor: (candidate) =>
      fallbackDateFor(candidate, everyCanvasItem, settings.startDate, settings.defaultDueTime),
  });

  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<Set<ImportItemType>>(new Set(["assignment", "quiz", "page"]));
  const [status, setStatus] = useState<StatusFilter>("all");
  const [moduleFilter, setModuleFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "dueAt", direction: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherModule, setOtherModule] = useState(moduleNames[0] ?? "Imported from Canvas");

  if (canvasError)
    return <div className="text-rose-300">Couldn&apos;t load Canvas: {canvasError.message}</div>;
  if (!candidates)
    return (
      <div className="flex flex-row gap-2 items-center">
        <Spinner /> Loading what Canvas has...
      </div>
    );

  const canvasModuleNames = [...new Set(everyCanvasItem.flatMap((c) => c.canvasModules))];
  const folderModules = [
    ...new Set([...moduleNames, ...canvasModuleNames.filter((m) => !validateFileName(m))]),
  ];
  const moduleCell = (c: ImportCandidate) => c.canvasModules.join(", ");
  // a file is named after its item, so only one of same-named items can come in
  const sameNameCount = (c: ImportCandidate) =>
    candidates.filter((other) => other.type === c.type && other.name === c.name).length;

  const sortValue = (c: ImportCandidate): string | number => {
    switch (sort.key) {
      case "type":
        return c.type;
      case "name":
        return c.name.toLowerCase();
      case "module":
        return moduleCell(c).toLowerCase() || "\uffff";
      case "dueAt":
        return c.dueAt ? getDateFromString(c.dueAt)!.getTime() : Number.MAX_SAFE_INTEGER;
      case "points":
        return c.points ?? -1;
      case "group":
        return groupName(c.canvasAssignmentGroupId).toLowerCase() || "\uffff";
      case "published":
        return c.published ? 0 : 1;
    }
  };

  const term = search.trim().toLowerCase();
  const shown = candidates
    .filter((c) => types.has(c.type))
    .filter((c) => status === "all" || c.published === (status === "published"))
    .filter(
      (c) =>
        !moduleFilter ||
        (moduleFilter === NOT_IN_A_MODULE
          ? c.canvasModules.length === 0
          : c.canvasModules.includes(moduleFilter)),
    )
    .filter(
      (c) =>
        !term ||
        c.name.toLowerCase().includes(term) ||
        moduleCell(c).toLowerCase().includes(term) ||
        groupName(c.canvasAssignmentGroupId).toLowerCase().includes(term),
    )
    .sort((a, b) => {
      const x = sortValue(a);
      const y = sortValue(b);
      const byKey = x < y ? -1 : x > y ? 1 : 0;
      return byKey * sort.direction || a.name.localeCompare(b.name);
    });

  const importable = (c: ImportCandidate) => !c.nameError;
  const shownImportable = shown.filter(importable);
  const checked = candidates.filter((c) => selected.has(c.key) && importable(c));
  const allShownChecked = shownImportable.length > 0 && shownImportable.every((c) => selected.has(c.key));
  const needsOtherModule = checked.some(
    (c) => c.canvasModules.length === 0 || validateFileName(c.canvasModules[0]),
  );

  const toggle = (key: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleAllShown = () =>
    setSelected((previous) => {
      const next = new Set(previous);
      for (const c of shownImportable) {
        if (allShownChecked) next.delete(c.key);
        else next.add(c.key);
      }
      return next;
    });
  const toggleType = (type: ImportItemType) =>
    setTypes((previous) => {
      const next = new Set(previous);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  const startImport = async () => {
    const inTableOrder = [
      ...shown.filter((c) => checked.includes(c)),
      ...checked.filter((c) => !shown.includes(c)),
    ];
    await importer.importItems(inTableOrder, otherModule.trim());
    setSelected(new Set());
  };

  const header = (key: SortKey, label: string, className = "") => (
    <th className={`px-2 py-1 font-normal ${className}`}>
      <button
        className="unstyled uppercase tracking-wide hover:text-slate-100"
        onClick={() =>
          setSort((s) => ({ key, direction: s.key === key ? (-s.direction as 1 | -1) : 1 }))
        }
      >
        {label}
        {sort.key === key ? (sort.direction === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  const countOf = (type: ImportItemType) => candidates.filter((c) => c.type === type).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-slate-400">
        These are in Canvas but have no file here (matched by name). Check the
        ones to bring in and import them: each becomes a markdown file in the
        module Canvas has it in, and any assignment group or module it needs is
        added first. Nothing in Canvas changes.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="search"
          placeholder="Filter by name, module or group"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-500 rounded-md px-2 py-1 min-w-64 flex-1"
          aria-label="Filter"
        />
        {(Object.keys(typeLabels) as ImportItemType[]).map((type) => (
          <label key={type} className="flex items-center gap-1 select-none">
            <input type="checkbox" checked={types.has(type)} onChange={() => toggleType(type)} />
            {typeLabels[type]} ({countOf(type)})
          </label>
        ))}
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Published filter"
        >
          <option value="all">Published or not</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>
        <select className={selectClass} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} aria-label="Module filter">
          <option value="">Every Canvas module</option>
          <option value={NOT_IN_A_MODULE}>Not in a module</option>
          {canvasModuleNames.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button disabled={checked.length === 0 || importer.running || !otherModule.trim()} onClick={startImport}>
          Import {checked.length} selected
        </button>
        {checked.length > 0 && !importer.running && (
          <button className="unstyled btn-outline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        )}
        {needsOtherModule && (
          <label className="flex items-center gap-2">
            Items not in a Canvas module go in
            <input
              className="bg-slate-800 border border-slate-500 rounded-md px-2 py-1"
              list="import-module-names"
              value={otherModule}
              onChange={(e) => setOtherModule(e.target.value)}
              aria-label="Module for items not in a Canvas module"
            />
            <datalist id="import-module-names">
              {folderModules.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
        )}
        {importer.current && (
          <span className="flex items-center gap-2 text-slate-300">
            <Spinner /> Importing {importer.current.index} of {importer.current.total}: {importer.current.name}
          </span>
        )}
      </div>

      {importer.results.length > 0 && (
        <ImportResults
          results={importer.results}
          running={importer.running}
          onDismiss={importer.clearResults}
        />
      )}

      {candidates.length === 0 ? (
        <div className="text-emerald-300">Everything in Canvas has a file here.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 !text-xs">
              <tr>
                <th className="px-2 py-1 w-6">
                  <input
                    type="checkbox"
                    aria-label="Select all shown"
                    checked={allShownChecked}
                    onChange={toggleAllShown}
                  />
                </th>
                {header("type", "Type", "text-start")}
                {header("name", "Name", "text-start")}
                {header("module", "Canvas module", "text-start")}
                {header("dueAt", "Due", "text-start")}
                {header("points", "Points", "text-end")}
                {header("group", "Assignment group", "text-start")}
                {header("published", "Status", "text-start")}
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr
                  key={c.key}
                  className={`border-t border-slate-700 ${importable(c) ? "cursor-pointer hover:bg-slate-800" : "opacity-60"}`}
                  onClick={() => importable(c) && toggle(c.key)}
                >
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.name}`}
                      checked={selected.has(c.key)}
                      disabled={!importable(c)}
                      onChange={() => toggle(c.key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <span className="flex items-center gap-1 capitalize">
                      <span className="w-4 h-4 inline-block">
                        <ItemTypeIcon type={c.type} />
                      </span>
                      {c.type}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    {c.htmlUrl ? (
                      <a href={c.htmlUrl} target="_blank" onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </a>
                    ) : (
                      c.name
                    )}
                    {sameNameCount(c) > 1 && (
                      <div className="text-amber-300 text-xs">
                        Canvas has {sameNameCount(c)} {c.type}s with this name; only one can be imported.
                      </div>
                    )}
                    {c.nameError && (
                      <div className="text-rose-300 text-xs">
                        Can&apos;t be a file name: {c.nameError}. Rename it in Canvas first.
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-slate-300">
                    {moduleCell(c) || <span className="text-slate-500 italic">not in a module</span>}
                  </td>
                  <td className="px-2 py-1 text-slate-300 whitespace-nowrap">{formatDate(c.dueAt)}</td>
                  <td className="px-2 py-1 text-end text-slate-300">
                    {c.points ?? ""}
                    {c.questionCount !== undefined && (
                      <span className="text-slate-500">
                        {" "}
                        · {c.questionCount} q
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-slate-300">{groupName(c.canvasAssignmentGroupId)}</td>
                  <td className={`px-2 py-1 ${c.published ? "text-emerald-300" : "text-slate-500"}`}>
                    {c.published ? "Published" : "Unpublished"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-slate-500 text-xs mt-1">
            Showing {shown.length} of {candidates.length}.{" "}
            <Link to={getCourseUrl(courseName)} className="underline">
              Back to the course
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportResults({
  results,
  running,
  onDismiss,
}: {
  results: ImportResult[];
  running: boolean;
  onDismiss: () => void;
}) {
  const { courseName } = useCourseContext();
  const imported = results.filter((r) => r.outcome.status === "imported");
  const failed = results.length - imported.length;
  const noted = imported.filter((r) => r.outcome.status === "imported" && r.outcome.warnings.length > 0);
  return (
    <div className="border border-slate-700 rounded p-3 text-sm">
      <div className="flex items-center gap-3">
        <div className="font-bold flex-1">
          {running ? `Imported ${imported.length} so far` : `Imported ${imported.length} of ${results.length}`}
          {failed > 0 && <span className="text-rose-300">, {failed} failed</span>}
          {noted.length > 0 && <span className="text-amber-300">, {noted.length} with notes</span>}
        </div>
        {!running && (
          <button className="unstyled btn-outline" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
      <ul className="mt-2 flex flex-col gap-1 !list-none !ps-0">
        {results.map(({ candidate, outcome }) => (
          <li key={candidate.key}>
            {outcome.status === "imported" ? (
              <>
                <span className="text-emerald-300">✓ </span>
                <Link
                  className="underline"
                  to={getModuleItemUrl(courseName, outcome.moduleName, candidate.type, candidate.name)}
                >
                  {candidate.name}
                </Link>
                <span className="text-slate-500"> in {outcome.moduleName}</span>
                {outcome.warnings.length > 0 && (
                  <ul className="ms-6 list-disc text-amber-200">
                    {outcome.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <span className="text-rose-300">✗ {candidate.name}: </span>
                <span className="text-rose-200">{outcome.error}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
