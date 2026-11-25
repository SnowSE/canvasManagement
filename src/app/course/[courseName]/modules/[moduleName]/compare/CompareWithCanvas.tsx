"use client";
import { useSettingsWithCanvasFiles } from "@/features/canvas/hooks/canvasCourseFileHooks";
import { pullFromCanvas, pullQuestions, sendToCanvas } from "@/features/canvas/import/pullFromCanvas";
import { useMutation } from "@tanstack/react-query";
import { assignmentSettingsForCanvas, canvasAssignmentService } from "@/features/canvas/services/canvasAssignmentService";
import { canvasQuizService, quizSettingsForCanvas } from "@/features/canvas/services/canvasQuizService";
import Modal, { useModal } from "@/components/Modal";
import { FC, ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import DOMPurify from "isomorphic-dompurify";
import { Spinner } from "@/components/Spinner";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { editorItemKey, takeNextFromServer } from "@/app/course/[courseName]/utils/useAuthoritativeUpdates";
import { useAssignmentQuery, useUpdateAssignmentMutation } from "@/features/local/assignments/assignmentHooks";
import { useQuizQuery, useUpdateQuizMutation } from "@/features/local/quizzes/quizHooks";
import { usePageQuery, useUpdatePageMutation } from "@/features/local/pages/pageHooks";
import {
  useCanvasPagesQuery,
  useUpdateCanvasPageMutation,
} from "@/features/canvas/hooks/canvasPageHooks";
import {
  useCanvasAssignmentsQuery,
} from "@/features/canvas/hooks/canvasAssignmentHooks";
import {
  useCanvasAttemptQuestionsQuery,
  useCanvasQuizQuestionsQuery,
  useCanvasQuizVersionsTakenQuery,
  useCanvasQuizzesQuery,
  useSendQuestionToCanvasMutation,
} from "@/features/canvas/hooks/canvasQuizHooks";
import { useCanvasModuleNames } from "@/features/canvas/hooks/canvasModuleHooks";
import { checkQuizQuestions, questionRow, questionsMoveAlone } from "@/app/course/[courseName]/calendar/day/quizQuestionSync";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import {
  useRosterGroupSetsQuery,
  useRosterStudentsQuery,
} from "@/features/canvas/roster/rosterHooks";
import { baseCanvasUrl } from "@/features/canvas/services/canvasServiceUtils";
import {
  SyncField,
  SyncReport,
  SyncSection,
  descriptionRenderer,
  getSyncReport,
} from "@/app/course/[courseName]/calendar/day/getAssignmentSyncStatus";
import { getModuleItemUrl } from "@/services/urlUtils";
import {
  collapseUnchanged,
  diffHtmlText,
  diffNormalizedHtml,
  diffSides,
} from "@/services/utils/htmlTextDiff";

const sectionLabels: Record<SyncSection, string> = {
  modules: "Modules",
  dates: "Dates",
  grading: "Grading",
  submission: "Submission",
  groups: "Groups",
  schedule: "Schedule",
  rubric: "Rubric",
  questions: "Questions",
  options: "Quiz options",
  description: "Description",
};

/* ------------------------------------------------------------------ */
/* Per-type wrappers: load the file and Canvas copies, build the report */
/* ------------------------------------------------------------------ */

export function CompareAssignmentWithCanvas({
  moduleName,
  assignmentName,
}: {
  moduleName: string;
  assignmentName: string;
}) {
  // with each course file's address in Canvas, as the item's links to files are sent
  const settings = useSettingsWithCanvasFiles();
  const { data: assignment } = useAssignmentQuery(moduleName, assignmentName);
  const {
    data: canvasAssignments,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useCanvasAssignmentsQuery();
  const { data: canvasQuizzes } = useCanvasQuizzesQuery();
  const { data: rosterStudents } = useRosterStudentsQuery();
  const { data: rosterGroupSets } = useRosterGroupSetsQuery();
  const save = useUpdateAssignmentMutation();
  const { courseName } = useCourseContext();

  const canvasAssignment = canvasAssignments?.find(
    (a) => a.name === assignmentName,
  );
  const { names: canvasModules, refetch: refetchModules } =
    useCanvasModuleNames("assignment", canvasAssignment);

  // never compare against a stale copy
  useEffect(() => {
    refetch();
    refetchModules();
  }, [refetch, refetchModules]);

  const report = useMemo(
    () =>
      getSyncReport({
        item: assignment,
        canvasItem: canvasAssignment,
        type: "assignment",
        settings,
        canvasLinkTargets: {
          assignments: canvasAssignments,
          quizzes: canvasQuizzes,
        },
        roster: { students: rosterStudents, groupSets: rosterGroupSets },
        module: canvasModules && { file: moduleName, canvas: canvasModules },
      }),
    [
      assignment,
      canvasAssignment,
      canvasAssignments,
      canvasModules,
      canvasQuizzes,
      moduleName,
      rosterGroupSets,
      rosterStudents,
      settings,
    ],
  );

  const pull = useMemo(
    () =>
      canvasAssignment &&
      pulling((fields) => pullFromCanvas("assignment", assignment, canvasAssignment, fields, settings, descriptionRenderer("assignment", assignment, settings, { assignments: canvasAssignments, quizzes: canvasQuizzes })), report.differences, report.fields),
    [assignment, canvasAssignment, canvasAssignments, canvasQuizzes, report, settings],
  );

  const sendRows = useMutation({
    mutationFn: (fields: Record<string, unknown>) => canvasAssignmentService.sendFields(settings.canvasId, canvasAssignment!.id, fields),
    onSuccess: () => refetch(),
  });
  const send = useMemo(
    () =>
      canvasAssignment &&
      sending(
        "assignment",
        () => assignmentSettingsForCanvas(assignment, settings, settings.assignmentGroups.find((g) => g.name === assignment.localAssignmentGroupName)?.canvasId, { assignments: canvasAssignments, quizzes: canvasQuizzes }),
        report.fields,
      ),
    [assignment, canvasAssignment, canvasAssignments, canvasQuizzes, report, settings],
  );

  return (
    <CompareLayout
      type="assignment"
      moduleName={moduleName}
      itemName={assignmentName}
      report={report}
      canvasLoading={canvasAssignments === undefined}
      canvasFetching={isFetching}
      loadedAt={dataUpdatedAt}
      canvasId={canvasAssignment?.id}
      canvasPublished={canvasAssignment?.published}
      canvasUrl={
        canvasAssignment &&
        `${baseCanvasUrl}/courses/${settings.canvasId}/assignments/${canvasAssignment.id}`
      }
      onRefresh={() => {
        refetch();
        refetchModules();
      }}
      updating={save.isPending || sendRows.isPending}
      send={send && { sent: send.sent, onSend: (fields) => sendRows.mutate(send.bodyFor(fields)) }}
      pull={pull && { ...pull, onPull: (fields) => {
          // the editor open on it takes this, though it may be a text it knew (see takeNextFromServer)
          takeNextFromServer(editorItemKey("assignment", moduleName, assignmentName));
          save.mutate({ assignment: pull.itemWith(fields), moduleName, assignmentName, previousModuleName: moduleName, previousAssignmentName: assignmentName, courseName });
        } }}
      updateNote="Update Canvas pushes the file's dates, group settings, rubric and description, and moves the assignment to the file's module. Submissions and grades are untouched."
    />
  );
}

export function CompareQuizWithCanvas({
  moduleName,
  quizName,
}: {
  moduleName: string;
  quizName: string;
}) {
  // with each course file's address in Canvas, as the item's links to files are sent
  const settings = useSettingsWithCanvasFiles();
  const { data: quiz } = useQuizQuery(moduleName, quizName);
  const {
    data: canvasQuizzes,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useCanvasQuizzesQuery();
  const { data: canvasAssignments } = useCanvasAssignmentsQuery();
  const sendQuestion = useSendQuestionToCanvasMutation();
  const save = useUpdateQuizMutation();
  const { courseName } = useCourseContext();

  const canvasQuiz = canvasQuizzes?.find((q) => q.title === quizName);
  const { names: canvasModules, refetch: refetchModules } =
    useCanvasModuleNames("quiz", canvasQuiz);

  useEffect(() => {
    refetch();
    refetchModules();
  }, [refetch, refetchModules]);

  const {
    data: canvasQuestions,
    isFetching: questionsFetching,
    refetch: refetchQuestions,
    dataUpdatedAt: questionsUpdatedAt,
  } = useCanvasQuizQuestionsQuery(canvasQuiz?.id);
  const { data: versions, refetch: refetchVersions } =
    useCanvasQuizVersionsTakenQuery(canvasQuiz?.id);
  const report = useMemo(
    () =>
      getSyncReport({
        item: quiz,
        canvasItem: canvasQuiz,
        type: "quiz",
        settings,
        canvasLinkTargets: {
          assignments: canvasAssignments,
          quizzes: canvasQuizzes,
        },
        canvasQuestions,
        module: canvasModules && { file: moduleName, canvas: canvasModules },
      }),
    [
      canvasAssignments,
      canvasModules,
      canvasQuestions,
      canvasQuiz,
      canvasQuizzes,
      moduleName,
      quiz,
      settings,
    ],
  );

  // each question moves alone, either way, in sync or not, unless a side has question groups (those go whole: Update in Canvas)
  const movable = useMemo(
    () => (canvasQuestions && questionsMoveAlone(quiz.questions, canvasQuestions) ? report.fields.filter((f) => questionRow(f)) : []),
    [canvasQuestions, quiz.questions, report],
  );
  const pull = useMemo(
    () =>
      canvasQuiz &&
      pulling((fields) => {
        const settingsPulled = pullFromCanvas("quiz", quiz, canvasQuiz, fields, settings, descriptionRenderer("quiz", quiz, settings, { assignments: canvasAssignments, quizzes: canvasQuizzes }));
        const questions = fields.filter((f) => movable.some((m) => m.key === f.key));
        return {
          item: { ...settingsPulled.item, questions: pullQuestions(quiz.questions, canvasQuestions ?? [], questions.map((f) => questionRow(f)!)) },
          pulled: [...settingsPulled.pulled, ...questions],
          left: settingsPulled.left.filter((f) => !questions.includes(f)),
        };
      }, report.differences, report.fields),
    [quiz, canvasQuiz, canvasAssignments, canvasQuizzes, canvasQuestions, movable, report, settings],
  );

  const sendRows = useMutation({
    mutationFn: (fields: Record<string, unknown>) => canvasQuizService.sendFields(settings.canvasId, canvasQuiz!.id, fields),
    onSuccess: () => refetch(),
  });
  const send = useMemo(
    () =>
      canvasQuiz &&
      sending(
        "quiz",
        () => quizSettingsForCanvas(quiz, settings, settings.assignmentGroups.find((g) => g.name === quiz.localAssignmentGroupName)?.canvasId, { assignments: canvasAssignments, quizzes: canvasQuizzes }),
        report.fields,
      ),
    [quiz, canvasQuiz, canvasAssignments, canvasQuizzes, report, settings],
  );

  return (
    <CompareLayout
      type="quiz"
      moduleName={moduleName}
      itemName={quizName}
      report={report}
      canvasLoading={
        canvasQuizzes === undefined ||
        (canvasQuiz !== undefined && canvasQuestions === undefined)
      }
      canvasFetching={isFetching || questionsFetching}
      loadedAt={Math.min(dataUpdatedAt, questionsUpdatedAt || dataUpdatedAt)}
      canvasId={canvasQuiz?.id}
      canvasPublished={canvasQuiz?.published}
      canvasUrl={
        canvasQuiz &&
        `${baseCanvasUrl}/courses/${settings.canvasId}/quizzes/${canvasQuiz.id}`
      }
      onRefresh={() => {
        refetch();
        refetchModules();
        if (canvasQuiz) {
          refetchQuestions();
          refetchVersions();
        }
      }}
      updating={sendQuestion.isPending || save.isPending || sendRows.isPending}
      send={
        send && {
          sent: [...send.sent, ...movable],
          onSend: (fields) => {
            const questions = fields.filter((f) => movable.includes(f));
            const rest = fields.filter((f) => !movable.includes(f));
            if (rest.length) sendRows.mutate(send.bodyFor(rest));
            for (const f of questions) sendQuestion.mutate({ quiz, canvasQuiz: canvasQuiz!, row: questionRow(f)!, canvasQuestions: canvasQuestions! }, { onSuccess: () => refetchQuestions() });
          },
        }
      }
      pull={pull && { ...pull, onPull: (fields) => {
          // the editor open on it takes this, though it may be a text it knew (see takeNextFromServer)
          takeNextFromServer(editorItemKey("quiz", moduleName, quizName));
          save.mutate({ quiz: pull.itemWith(fields), moduleName, quizName, previousModuleName: moduleName, previousQuizName: quizName, courseName });
        } }}
      updateNote="Update Canvas pushes the file's settings, moves the quiz to the file's module and, if any question differs, replaces the questions in Canvas with the file's. When it replaces them on a published quiz, students keep getting the old questions until you click Save it now on the quiz page in Canvas (the API can't do that). If students have started, it warns first: they keep the questions they got and are not regraded. It refuses to change the point total they were scored out of."
    >
      {versions?.map((v, i) => (
        <VersionSection
          key={v.version}
          version={v}
          latest={i === 0}
          quiz={quiz}
          settings={settings}
        />
      ))}
    </CompareLayout>
  );
}

export function ComparePageWithCanvas({
  moduleName,
  pageName,
}: {
  moduleName: string;
  pageName: string;
}) {
  // with each course file's address in Canvas, as the item's links to files are sent
  const settings = useSettingsWithCanvasFiles();
  const { data: page } = usePageQuery(moduleName, pageName);
  const {
    data: canvasPages,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useCanvasPagesQuery();
  const { data: canvasAssignments } = useCanvasAssignmentsQuery();
  const { data: canvasQuizzes } = useCanvasQuizzesQuery();
  const update = useUpdateCanvasPageMutation();
  const save = useUpdatePageMutation();
  const { courseName } = useCourseContext();

  const canvasPage = canvasPages?.find((p) => p.title === pageName);
  const { names: canvasModules, refetch: refetchModules } =
    useCanvasModuleNames("page", canvasPage);

  useEffect(() => {
    refetch();
    refetchModules();
  }, [refetch, refetchModules]);

  const report = useMemo(
    () =>
      getSyncReport({
        item: page,
        canvasItem: canvasPage,
        type: "page",
        settings,
        canvasLinkTargets: {
          assignments: canvasAssignments,
          quizzes: canvasQuizzes,
        },
        module: canvasModules && { file: moduleName, canvas: canvasModules },
      }),
    [
      canvasAssignments,
      canvasModules,
      canvasPage,
      canvasQuizzes,
      moduleName,
      page,
      settings,
    ],
  );

  const pull = useMemo(
    () => canvasPage && pulling((fields) => pullFromCanvas("page", page, canvasPage, fields, settings, descriptionRenderer("page", page, settings, { assignments: canvasAssignments, quizzes: canvasQuizzes })), report.differences, report.fields),
    [page, canvasPage, canvasAssignments, canvasQuizzes, report, settings],
  );

  return (
    <CompareLayout
      type="page"
      moduleName={moduleName}
      itemName={pageName}
      report={report}
      canvasLoading={canvasPages === undefined}
      canvasFetching={isFetching}
      loadedAt={dataUpdatedAt}
      canvasId={canvasPage?.page_id}
      canvasUrl={
        canvasPage &&
        `${baseCanvasUrl}/courses/${settings.canvasId}/pages/${canvasPage.url}`
      }
      onRefresh={() => {
        refetch();
        refetchModules();
      }}
      updating={update.isPending || save.isPending}
      // a page's one row is its content, which is all Update sends
      send={canvasPage && { sent: report.fields.filter((f) => f.key === "description"), onSend: () => update.mutate({ page, canvasPage, moduleName }) }}
      pull={pull && { ...pull, onPull: (fields) => {
          // the editor open on it takes this, though it may be a text it knew (see takeNextFromServer)
          takeNextFromServer(editorItemKey("page", moduleName, pageName));
          save.mutate({ page: pull.itemWith(fields), moduleName, pageName, previousModuleName: moduleName, previousPageName: pageName, courseName });
        } }}
      updateNote="Update in Canvas replaces the page's content with the file's and moves the page to the file's module."
    />
  );
}

/**
 * The file against the questions students got on one quiz version, read
 * from one attempt. Canvas's current questions can differ from these until
 * "Save it now", and the API has no "unsaved changes" flag, so this is the
 * only way to see what students actually got.
 */
const VersionSection: FC<{
  version: { version: number; attempts: number; attemptId: number };
  latest: boolean;
  quiz: LocalQuiz;
  settings: LocalCourseSettings;
}> = ({ version, latest, quiz, settings }) => {
  const { data: questions } = useCanvasAttemptQuestionsQuery(version.attemptId);
  const fields = useMemo(
    () =>
      questions &&
      checkQuizQuestions(quiz.questions, questions, settings, {
        ignoreAnswerOrder: true,
        isAttempt: true,
      }),
    [questions, quiz.questions, settings],
  );
  const differing = fields?.filter((f) => !f.same).length ?? 0;
  const title = `What students got · version ${version.version}${latest ? " (latest)" : ""} · ${version.attempts} attempt${version.attempts === 1 ? "" : "s"}${fields ? ` · ${differing === 0 ? "matches the file" : `${differing} question${differing === 1 ? "" : "s"} differ`}` : ""}`;
  return fields ? (
    <FieldsTable fields={fields} title={title} canvasLabel="students got" />
  ) : (
    <div className="pb-6 text-sm text-slate-400">
      {title} <Spinner />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Shared page                                                          */
/* ------------------------------------------------------------------ */

const CompareLayout: FC<{
  type: "assignment" | "page" | "quiz";
  moduleName: string;
  itemName: string;
  report: SyncReport;
  canvasLoading: boolean;
  canvasFetching: boolean;
  /** When the Canvas copy shown was read (ms since epoch). */
  loadedAt: number;
  canvasId?: number;
  canvasPublished?: boolean;
  canvasUrl?: string;
  onRefresh: () => void;
  updating: boolean;
  updateNote: string;
  /** Pull from Canvas (see pullFromCanvas): what it would set in the file, what it leaves, and doing it. */
  pull?: { pulled: SyncField[]; left: SyncField[]; movable: SyncField[]; onPull: (fields: SyncField[]) => void };
  /** Send to Canvas a row at a time (see sendToCanvas): the rows that can go alone, and sending some. */
  send?: { sent: SyncField[]; onSend: (fields: SyncField[]) => void };
  /** Extra sections after the settings and questions, such as what students got. */
  children?: ReactNode;
}> = ({
  type,
  moduleName,
  itemName,
  report,
  canvasLoading,
  canvasFetching,
  loadedAt,
  canvasId,
  canvasPublished,
  canvasUrl,
  onRefresh,
  updating,
  updateNote,
  pull,
  send,
  children,
}) => {
  const { courseName } = useCourseContext();
  const editUrl = getModuleItemUrl(courseName, moduleName, type, itemName);
  const inCanvas = report.status !== "localOnly";
  // the rows being confirmed and which way they go: to Canvas (one row's own send), or into the file (all that can be pulled, or one row's own)
  const confirm = useModal();
  const [asking, setAsking] = useState<{ to: "canvas" | "file"; fields: SyncField[] }>({ to: "file", fields: [] });
  const ask = (to: "canvas" | "file", fields: SyncField[]) => {
    setAsking({ to, fields });
    confirm.openModal();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-5">
        <div className="flex flex-row flex-wrap justify-between items-end gap-3 pt-3 pb-4">
          <div className="min-w-0">
            <div className="text-sm text-slate-400 flex flex-row flex-wrap items-center gap-x-3">
              {canvasLoading ? (
                <span>loading Canvas…</span>
              ) : inCanvas ? (
                <span>
                  Canvas {type} {canvasId}
                  {!canvasPublished && " · not published"}
                </span>
              ) : (
                <span>not in Canvas yet</span>
              )}
              {loadedAt > 0 && (
                <span>read from Canvas at {new Date(loadedAt).toLocaleTimeString()}</span>
              )}
              <button
                className="unstyled text-blue-300 hover:underline disabled:opacity-50"
                onClick={onRefresh}
                disabled={canvasFetching}
              >
                {canvasFetching ? "refreshing…" : "refresh"}
              </button>
              {canvasFetching && <Spinner />}
            </div>
          </div>
          <StatusPill report={report} canvasLoading={canvasLoading} />
        </div>

        {inCanvas && (
          <>
            <FieldsTable fields={report.fields} pullable={pull?.movable} sendable={send?.sent} onMove={(to, field) => ask(to, [field])} />
            {children}
            {report.description && (
              <DescriptionDiff
                localHtml={report.description.localHtml}
                canvasHtml={report.description.canvasHtml}
                same={report.description.same}
              />
            )}
          </>
        )}
        {!inCanvas && !canvasLoading && (
          <div className="py-10 text-center text-slate-400">
            This {type} hasn't been added to Canvas, so there is nothing to
            compare. Add it from the{" "}
            <Link to={editUrl} className="text-blue-300 hover:underline">
              editor
            </Link>
            .
          </div>
        )}
        <div className="h-6" />
      </div>

      <div className="flex-none sticky bottom-0 border-t border-slate-700 bg-gray-900/95 backdrop-blur px-3 sm:px-5 py-3 flex flex-row flex-wrap justify-between items-center gap-3">
        <div className="text-sm text-slate-400 max-w-prose">{updateNote}</div>
        <div className="flex flex-row flex-wrap gap-3 justify-end items-center">
          {updating && <Spinner />}
          {canvasUrl && (
            <a className="btn" href={canvasUrl} target="_blank" rel="noreferrer">
              Open in Canvas ↗
            </a>
          )}
          {pull && (
            <button
              className="unstyled btn-outline"
              disabled={updating || pull.pulled.length === 0}
              title={pull.pulled.length === 0 ? "Nothing that differs can be pulled into the file" : "Make the file match Canvas where they differ (a row's own arrow pulls that row alone)"}
              onClick={() => ask("file", pull.pulled)}
            >
              ← Pull all from Canvas…
            </button>
          )}
          <MoveConfirmation
            control={confirm}
            to={asking.to}
            fields={asking.fields}
            left={asking.to === "file" && asking.fields.length === pull?.pulled.length ? pull.left : []}
            onConfirm={() => (asking.to === "file" ? pull?.onPull(asking.fields) : send?.onSend(asking.fields))}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Sending rows to Canvas on their own (see sendToCanvas): `whole` builds
 * everything Update Canvas would send; where it can't be built (the file
 * has something Canvas won't take), no row can go alone.
 */
const sending = (type: "assignment" | "quiz" | "page", whole: () => Record<string, unknown>, rows: SyncField[]) => {
  let body: Record<string, unknown> = {};
  try {
    body = whole();
  } catch {
    // nothing sendable
  }
  // every row that can go alone, in sync or not: an arrow on a green row sends the file's exact value anyway
  return { sent: sendToCanvas(type, body, rows).sent, bodyFor: (fields: SyncField[]) => sendToCanvas(type, body, fields).body };
};

/**
 * Pulling all that differs (`pulled`, `left`), pulling only some rows
 * (`itemWith`), and every row that can be pulled alone, in sync or not
 * (`movable`: an arrow on a green row takes Canvas's exact value anyway).
 * See pullFromCanvas.
 */
const pulling = <T,>(pullRows: (fields: SyncField[]) => { item: T; pulled: SyncField[]; left: SyncField[] }, differences: SyncField[], rows: SyncField[]) => ({
  ...pullRows(differences),
  movable: pullRows(rows).pulled,
  itemWith: (fields: SyncField[]) => pullRows(fields).item,
});

/**
 * The confirmation before a value moves, either way: into the file (Pull
 * from Canvas: see pullFromCanvas) or to Canvas (a row sent on its own: see
 * sendToCanvas). It lists each row with the value that is lost and the one
 * that replaces it, and its button says what happens.
 */
const MoveConfirmation: FC<{ control: ReturnType<typeof useModal>; to: "canvas" | "file"; fields: SyncField[]; left: SyncField[]; onConfirm: () => void }> = ({ control, to, fields, left, onConfirm }) => {
  const [losing, taking] = to === "file" ? ["the file", "Canvas"] : ["Canvas", "the file"];
  const one = fields.length === 1;
  return (
    <Modal modalControl={control} modalWidth="w-150">
      {({ closeModal }) => (
        <div className="flex flex-col gap-3 text-sm">
          <div className="font-semibold text-rose-300">
            {to === "file" ? "Pull from Canvas" : "Send to Canvas"}: {losing === "Canvas" ? "Canvas's" : "the file's"} own {one ? "value for this is" : "values for these are"} lost, replaced by {taking === "Canvas" ? "Canvas's" : "the file's"}.
          </div>
          <ul className="list-disc ps-5">
            {fields.map((f) => {
              const [lost, kept] = to === "file" ? [f.local, f.canvas] : [f.canvas, f.local];
              return (
                <li key={f.key}>
                  {f.key === "description" ? (
                    to === "file" ? (
                      <>{f.label}: the blocks that differ (a paragraph, a list…) become Canvas&apos;s own HTML; the rest stays as written</>
                    ) : (
                      <>{f.label}: Canvas&apos;s becomes the file&apos;s, as the file renders it</>
                    )
                  ) : (
                    <>
                      {f.label}: <span className="line-through text-slate-400">{lost}</span> becomes <span className="text-slate-100 font-semibold">{kept}</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {left.length > 0 && <div className="text-slate-400">Not pulled, staying as the file has them: {left.map((f) => f.label).join(", ")}.</div>}
          <div className="flex gap-2 justify-end">
            <button className="unstyled btn-outline" onClick={closeModal}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={() => {
                closeModal();
                onConfirm();
              }}
            >
              Replace {losing === "Canvas" ? "Canvas's" : "the file's"} {one ? "value" : `${fields.length} values`} with {taking === "Canvas" ? "Canvas's" : "the file's"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

const StatusPill: FC<{ report: SyncReport; canvasLoading: boolean }> = ({
  report,
  canvasLoading,
}) => {
  if (canvasLoading)
    return <Pill className="text-slate-300 border-slate-600">checking…</Pill>;
  if (report.status === "localOnly")
    return <Pill className="text-slate-300 border-slate-600">not in Canvas</Pill>;
  const n = report.differences.length;
  if (n === 0)
    return (
      <Pill className="text-green-300 border-green-800 bg-green-900/30">
        <Dot className="bg-green-500" /> in sync
      </Pill>
    );
  return (
    <Pill className="text-rose-300 border-rose-900 bg-rose-900/30">
      <Dot className="bg-rose-500" /> {n} difference{n === 1 ? "" : "s"}
    </Pill>
  );
};

const Pill: FC<{ className: string; children: ReactNode }> = ({
  className,
  children,
}) => (
  <span
    className={
      "inline-flex items-center gap-2 px-3 py-0.5 rounded-full border text-sm font-semibold whitespace-nowrap " +
      className
    }
  >
    {children}
  </span>
);

/** An arrow toward the side a value moves to: left into the file, right to Canvas. */
const ArrowIcon: FC<{ to: "canvas" | "file" }> = ({ to }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="inline-block align-[-2px]">
    {to === "canvas" ? <path d="M3 8h10M9 4l4 4-4 4" /> : <path d="M13 8H3M7 4 3 8l4 4" />}
  </svg>
);

const Dot: FC<{ className: string }> = ({ className }) => (
  <span className={"inline-block w-2 h-2 rounded-full " + className} />
);

/* ------------------------------------------------------------------ */
/* Settings table                                                       */
/* ------------------------------------------------------------------ */

const FieldsTable: FC<{
  fields: SyncField[];
  title?: ReactNode;
  /** What the right-hand column is, e.g. what students got. */
  canvasLabel?: string;
  /** The rows that can move alone, each way: an arrow sends the file's value to Canvas, the other pulls Canvas's into the file. */
  pullable?: SyncField[];
  sendable?: SyncField[];
  onMove?: (to: "canvas" | "file", field: SyncField) => void;
}> = ({ fields, title, canvasLabel = "Canvas now", pullable = [], sendable = [], onMove }) => {
  const arrow = (f: SyncField, to: "canvas" | "file") => (
    <button
      className="unstyled p-0.5 rounded text-slate-400 hover:bg-slate-700 hover:text-slate-100"
      title={to === "canvas" ? `Send to Canvas: Canvas's ${f.label.toLowerCase()} becomes the file's…` : `Pull into the file: the file's ${f.label.toLowerCase()} becomes Canvas's…`}
      aria-label={to === "canvas" ? `Send ${f.label} to Canvas` : `Pull ${f.label} from Canvas`}
      onClick={() => onMove?.(to, f)}
    >
      <ArrowIcon to={to} />
    </button>
  );
  const has = (list: SyncField[], f: SyncField) => list.some((x) => x.key === f.key);
  const rows = fields.filter((f) => f.section !== "description");
  return (
    <section className="pb-6">
      <div className="flex flex-row flex-wrap justify-between items-baseline gap-3 pb-2">
        <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">
          {title ??
            (rows.some((f) => f.section === "questions")
              ? "Settings and questions"
              : "Settings")}
        </h3>
        <Legend canvasLabel={canvasLabel} />
      </div>
      <div className="overflow-x-auto">
        {/* fixed layout: with auto layout one long rubric label decided the
            first column's width and pushed File and Canvas off the page. The
            ! overrides the global table rule meant for markdown tables. */}
        <table className="!table !w-full table-fixed text-sm border-0 [&_td]:border-0 [&_th]:border-0">
          <colgroup>
            <col className="w-1/3 md:w-1/4" />
            <col />
            <col className="w-8" />
            <col />
            <col className="w-20" />
            <col className="w-8" />
          </colgroup>
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-400">
              <th className="text-start font-medium">Setting</th>
              <th className="text-start font-medium">File</th>
              <th></th>
              <th className="text-start font-medium">{canvasLabel}</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f, i) => {
              const newSection = i === 0 || rows[i - 1].section !== f.section;
              return (
                <tr
                  key={f.key}
                  className={
                    "group " +
                    (newSection ? "border-t border-slate-700 " : "") +
                    (f.same ? "text-slate-500" : "text-slate-200")
                  }
                >
                  <td className="align-top break-words">
                    <span className={f.same ? "" : "font-medium"}>{f.label}</span>
                    {newSection && (
                      <span className="block text-[10px] uppercase tracking-wider text-slate-600">
                        {sectionLabels[f.section]}
                      </span>
                    )}
                  </td>
                  <td className="align-top">
                    <Cell field={f} side="local" />
                  </td>
                  <td className="text-center text-slate-600 align-top whitespace-nowrap">
                    {/* a difference that can't move alone goes with the whole item: Update in Canvas, in the editor's footer */}
                    {!f.same && !has(pullable, f) && !has(sendable, f) && <span title="This row goes with the whole item: Update in Canvas, in the editor's footer">≠</span>}
                  </td>
                  <td className="align-top">
                    <Cell field={f} side="canvas" />
                  </td>
                  <td className={"text-end align-top whitespace-nowrap " + (f.same ? "opacity-30 group-hover:opacity-100 focus-within:opacity-100" : "")}>
                    {/* each way it can move on its own, in sync or not: a green row's value can still be sent or taken exactly */}
                    {has(pullable, f) && arrow(f, "file")}
                    {has(sendable, f) && arrow(f, "canvas")}
                  </td>
                  <td className="text-end align-top">
                    <Dot className={f.same ? "bg-green-600" : "bg-rose-500"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// every question shows in full, answers included, with what differs marked (see diffSides)
const Cell: FC<{ field: SyncField; side: "local" | "canvas" }> = ({ field, side }) => {
  const parts = useMemo(() => (field.same ? [{ value: field[side] }] : diffSides(field.local, field.canvas)[side]), [field, side]);
  const marked = side === "local" ? "bg-green-900/40 text-green-300" : "bg-rose-900/40 text-rose-300";
  return (
    <span className="font-mono text-xs whitespace-pre-line [overflow-wrap:anywhere]">
      {parts.map((part, i) => (
        <span key={i} className={part.added || part.removed ? "px-0.5 rounded [box-decoration-break:clone] " + marked : ""}>
          {part.value}
        </span>
      ))}
    </span>
  );
};

const Legend: FC<{ canvasLabel: string }> = ({ canvasLabel }) => (
  <div className="flex gap-4 text-xs text-slate-400">
    <span>
      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-900/60 border border-green-800 me-1.5 align-[-1px]" />
      your file
    </span>
    <span>
      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-900/60 border border-rose-900 me-1.5 align-[-1px]" />
      {canvasLabel}
    </span>
  </div>
);

/* ------------------------------------------------------------------ */
/* Description                                                          */
/* ------------------------------------------------------------------ */

type DescriptionView = "side" | "changes" | "html";

const DescriptionDiff: FC<{
  localHtml: string;
  canvasHtml: string;
  same: boolean;
}> = ({ localHtml, canvasHtml, same }) => {
  const [view, setView] = useState<DescriptionView>(same ? "side" : "changes");
  const safeCanvasHtml = useMemo(
    () => DOMPurify.sanitize(canvasHtml),
    [canvasHtml],
  );
  const textLines = useMemo(
    () => collapseUnchanged(diffHtmlText(localHtml, canvasHtml)),
    [localHtml, canvasHtml],
  );
  const htmlLines = useMemo(
    () => diffNormalizedHtml(localHtml, canvasHtml),
    [localHtml, canvasHtml],
  );
  const textChanged = textLines.some((l) => "kind" in l && l.kind === "changed");

  const tab = (id: DescriptionView, label: string) => (
    <button
      role="tab"
      aria-selected={view === id}
      className={
        "unstyled px-3 py-1 text-xs border-r border-slate-700 last:border-r-0 " +
        (view === id
          ? "bg-slate-800 text-slate-100 font-semibold"
          : "bg-transparent text-slate-400 hover:text-slate-200")
      }
      onClick={() => setView(id)}
    >
      {label}
    </button>
  );

  return (
    <section className="pb-6">
      <div className="flex flex-row flex-wrap justify-between items-center gap-3 pb-2">
        <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">
          Description
          <span
            className={
              "ms-3 normal-case tracking-normal font-normal " +
              (same ? "text-green-400" : "text-rose-300")
            }
          >
            {same ? "matches" : "differs"}
          </span>
        </h3>
        <div
          role="tablist"
          className="inline-flex rounded border border-slate-700 overflow-hidden"
        >
          {tab("side", "Side by side")}
          {tab("changes", "Changes only")}
          {tab("html", "HTML")}
        </div>
      </div>

      {view === "side" && (
        <div className="grid md:grid-cols-2 gap-3">
          <Panel title="File" subtitle="rendered from markdown" tone="file">
            <div
              className="markdownPreview p-3 text-sm"
              dangerouslySetInnerHTML={{ __html: localHtml }}
            />
          </Panel>
          <Panel title="Canvas" subtitle="current description" tone="canvas">
            <div
              className="markdownPreview p-3 text-sm"
              dangerouslySetInnerHTML={{ __html: safeCanvasHtml }}
            />
          </Panel>
        </div>
      )}

      {view === "changes" && (
        <div className="rounded border border-slate-700 bg-slate-800 p-3 text-sm leading-relaxed">
          {!textChanged && (
            <div className="text-slate-400">
              The visible text is the same on both sides.
              {!same &&
                " The difference is in the markup — see the HTML view."}
            </div>
          )}
          {textChanged &&
            textLines.map((line, i) =>
            "skipped" in line ? (
              <div
                key={i}
                className="text-center text-xs text-slate-500 font-mono my-1"
              >
                ··· {line.skipped} unchanged line{line.skipped === 1 ? "" : "s"} ···
              </div>
            ) : (
              <p
                key={i}
                className={
                  "my-1 " + (line.kind === "same" ? "text-slate-500" : "")
                }
              >
                {line.parts.map((p, j) =>
                  p.added ? (
                    <mark
                      key={j}
                      className="bg-green-900/50 text-green-200 rounded-sm px-0.5"
                    >
                      {p.value}
                    </mark>
                  ) : p.removed ? (
                    <mark
                      key={j}
                      className="bg-rose-900/50 text-rose-200 rounded-sm px-0.5 line-through decoration-rose-400/60"
                    >
                      {p.value}
                    </mark>
                  ) : (
                    <span key={j}>{p.value}</span>
                  ),
                )}
              </p>
            ),
          )}
        </div>
      )}

      {view === "html" && (
        <div>
          <pre className="rounded border border-slate-700 bg-gray-950 p-3 text-xs leading-relaxed overflow-x-auto font-mono">
            {htmlLines.map((l, i) => (
              <div
                key={i}
                className={
                  l.added
                    ? "bg-green-900/40 text-green-200"
                    : l.removed
                      ? "bg-rose-900/40 text-rose-200"
                      : "text-slate-400"
                }
              >
                <span className="inline-block w-4 text-slate-600 select-none">
                  {l.added ? "+" : l.removed ? "-" : " "}
                </span>
                {l.value}
              </div>
            ))}
          </pre>
          <div className="text-xs text-slate-500 pt-2 max-w-prose">
            Both sides with attributes other than href, scripts and whitespace
            between tags removed, which is roughly what the calendar's sync check
            compares. Green lines are in the file, rose lines only in Canvas. If
            the page says the description differs but nothing is highlighted
            here, the check is stricter than this view and the difference is in
            entities or attribute-free text.
          </div>
        </div>
      )}
    </section>
  );
};

const Panel: FC<{
  title: string;
  subtitle: string;
  tone: "file" | "canvas";
  children: ReactNode;
}> = ({ title, subtitle, tone, children }) => (
  <div className="rounded border border-slate-700 bg-slate-800 overflow-hidden min-w-0">
    <div className="flex justify-between px-3 py-1.5 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
      <span>{title}</span>
      <span
        className={
          "font-semibold " +
          (tone === "file" ? "text-green-300" : "text-rose-300")
        }
      >
        {subtitle}
      </span>
    </div>
    <div className="overflow-x-auto">{children}</div>
  </div>
);
