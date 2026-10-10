"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { EditLayout } from "@/components/EditLayout";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { CourseItemType } from "@/features/local/course/courseItemTypes";
import { useSaveRawItemMutation } from "@/features/local/modules/rawItemHooks";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { getCourseUrl, getModuleItemUrl } from "@/services/urlUtils";
import { useGitStatusQuery } from "@/features/local/git/gitHooks";
import { ItemTypeIcon } from "@/app/course/[courseName]/ItemTypeIcon";
import { BreadCrumbs } from "@/components/BreadCrumbs";
import { RightSingleChevron } from "@/components/icons/RightSingleChevron";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useGlobalSettingsQuery } from "@/features/local/globalSettings/globalSettingsHooks";
import { getFeedbackDelimitersFromSettings } from "@/features/local/globalSettings/globalSettingsUtils";
import { GlobalSettings } from "@/features/local/globalSettings/globalSettingsModels";
import { AssignmentHelp } from "../assignment/[assignmentName]/AssignmentHelp";
import { QuizHelp } from "../quiz/[quizName]/QuizHelp";
import {
  useErrorLogQuery,
  useExplainErrorMutation,
} from "@/features/local/errorLog/errorLogHooks";
import { markdownToHtmlNoImages } from "@/services/htmlMarkdownUtils";
import { getErrorMessage } from "@/services/utils/queryClient";
import { Spinner } from "@/components/Spinner";

const iconType = {
  Assignment: "assignment",
  Quiz: "quiz",
  Page: "page",
} as const;

/** Plain-text editor for a file that doesn't parse; saves as you type. */
export function RawItemEditor({
  moduleName,
  type,
  name,
  initialText,
  initialError,
}: {
  moduleName: string;
  type: CourseItemType;
  name: string;
  initialText: string;
  initialError: string;
}) {
  const { courseName } = useCourseContext();
  const [text, setText] = useState(initialText);
  const [error, setError] = useState(initialError);
  const [showHelp, setShowHelp] = useState(true);
  const save = useSaveRawItemMutation(moduleName, type, name);
  const { data: git } = useGitStatusQuery();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      save.mutate(
        { courseName, moduleName, type, name, text },
        { onSuccess: (result) => setError(result.error ?? "") },
      );
    }, 600);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // MonacoEditor remounts when onChange changes identity
  const onChange = useCallback((value: string) => setText(value), []);

  return (
    <EditLayout
      Header={
        <div className="flex flex-row items-center min-w-0">
          <BreadCrumbs />
          <span className="text-slate-500 cursor-default select-none my-auto">
            <RightSingleChevron />
          </span>
          <div className="w-5 ms-3 shrink-0 my-auto">
            <ItemTypeIcon type={iconType[type]} />
          </div>
          <div className="my-auto px-2 truncate min-w-10">{name}</div>
          <div className="my-auto text-rose-300 text-sm font-semibold whitespace-nowrap">
            can&rsquo;t be read
          </div>
        </div>
      }
      Help={showHelp ? <RawItemHelp type={type} /> : undefined}
      onCloseHelp={() => setShowHelp(false)}
      Editor={<MonacoEditor value={initialText} onChange={onChange} />}
      Preview={
        <div className="p-4 flex flex-col gap-3">
          <h4 className="text-rose-300">This file doesn&rsquo;t parse</h4>
          <p className="text-slate-300">
            Until it does, this {type.toLowerCase()} is missing from the
            calendar and can&rsquo;t be published. Fix it on the left: every
            change is saved to the file as you type, and the regular editor
            opens as soon as it parses.
          </p>
          <pre className="whitespace-pre-wrap break-words text-sm text-rose-200 bg-gray-950/60 rounded p-2">
            {error || "Parses now. Opening the editor…"}
          </pre>
          {save.isError && (
            <div className="text-amber-300 text-sm">
              Could not save: {getErrorMessage(save.error)}
            </div>
          )}
          <ExplainThisFile moduleName={moduleName} type={type} name={name} />
        </div>
      }
      Footer={
        <div className="flex items-center gap-3 px-2 py-1">
          <button
            className="unstyled btn-outline btn-thin"
            onClick={() => setShowHelp((h) => !h)}
          >
            {showHelp ? "Hide" : "Show"} syntax help
          </button>
          <Link className="btn btn-thin" to={getCourseUrl(courseName)}>
            Back to calendar
          </Link>
          {git?.status.available && (
            <Link
              className="btn btn-thin unstyled btn-outline"
              to={getModuleItemUrl(courseName, moduleName, iconType[type], name) + "/history"}
              title="Go back to a version of this file that worked"
            >
              File history
            </Link>
          )}
          {save.isPending && <Spinner />}
        </div>
      }
    />
  );
}

function RawItemHelp({ type }: { type: CourseItemType }) {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: globalSettings } = useGlobalSettingsQuery();
  if (type === "Assignment")
    return <AssignmentHelp settings={settings} groupSetNames={[]} />;
  if (type === "Quiz")
    return (
      <QuizHelp
        settings={settings}
        feedbackDelimiters={getFeedbackDelimitersFromSettings(
          (globalSettings ?? {}) as GlobalSettings,
        )}
      />
    );
  return (
    <div className="p-3 text-slate-300">
      A page file is one settings line, <code>DueDateForOrdering: MM/DD/YYYY</code>,
      then a line with only <code>---</code>, then the page content in markdown.
    </div>
  );
}

/** The error log's Explain button, for this file's entry. */
function ExplainThisFile({
  moduleName,
  type,
  name,
}: {
  moduleName: string;
  type: CourseItemType;
  name: string;
}) {
  const { courseName } = useCourseContext();
  const { data } = useErrorLogQuery();
  const explain = useExplainErrorMutation();
  const entry = data?.entries.find(
    (e) =>
      !e.resolved &&
      e.context?.courseName === courseName &&
      e.context.moduleName === moduleName &&
      e.context.itemType === type &&
      e.context.itemName === name,
  );
  if (!entry) return null;
  const explanation = entry.explanation ?? explain.data;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          className="btn-thin disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!data?.canExplain || explain.isPending || !!explanation}
          title={
            data?.canExplain
              ? "Ask the AI what is wrong with this file"
              : "Needs AI_BASE_URL and AI_MODEL in the app's .env"
          }
          onClick={() => explain.mutate(entry.id)}
        >
          {explain.isPending ? "Asking…" : "Explain with AI"}
        </button>
        {explain.isPending && <Spinner />}
      </div>
      {explain.isError && (
        <div className="text-amber-300 text-sm">
          {getErrorMessage(explain.error)}
        </div>
      )}
      {explanation && (
        <div
          className="markdownPreview text-slate-300"
          dangerouslySetInnerHTML={{ __html: markdownToHtmlNoImages(explanation) }}
        />
      )}
    </div>
  );
}
