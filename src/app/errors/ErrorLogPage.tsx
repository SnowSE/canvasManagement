"use client";
import { Link } from "@tanstack/react-router";
import {
  useClearErrorsMutation,
  useDismissErrorMutation,
  useErrorLogQuery,
  useExplainErrorMutation,
} from "@/features/local/errorLog/errorLogHooks";
import { ErrorLogEntry } from "@/features/local/errorLog/errorLogModels";
import { markdownToHtmlNoImages } from "@/services/htmlMarkdownUtils";
import { getErrorMessage } from "@/services/utils/queryClient";
import { getModuleItemUrl } from "@/services/urlUtils";
import { Spinner } from "@/components/Spinner";

const itemUrl = ({ context }: ErrorLogEntry) => {
  if (!context?.courseName || !context.moduleName || !context.itemName)
    return undefined;
  const type =
    context.itemType === "Assignment"
      ? "assignment"
      : context.itemType === "Quiz"
        ? "quiz"
        : context.itemType === "Page"
          ? "page"
          : undefined;
  return type
    ? getModuleItemUrl(context.courseName, context.moduleName, type, context.itemName)
    : undefined;
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function ErrorLogPage() {
  const { data, isLoading } = useErrorLogQuery();
  const clear = useClearErrorsMutation();
  const entries = data?.entries ?? [];

  return (
    <main className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link className="btn" to="/">
            Home
          </Link>
          <h3 className="text-center">
            Errors <span className="text-slate-500 text-xl">this session</span>
          </h3>
          <button
            className="unstyled btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => clear.mutate()}
            disabled={entries.length === 0 || clear.isPending}
          >
            Clear all
          </button>
        </div>
        <p className="text-slate-400 mt-2">
          Everything that went wrong since the app started, newest first. An
          error that happens again is counted rather than listed twice, and
          one that has since worked (a file that parses again) is marked
          fixed.
        </p>
        {data && !data.canExplain && (
          <p className="text-amber-300/90 mt-2 text-sm">
            To have AI explain an error, set <code>AI_BASE_URL</code> and{" "}
            <code>AI_MODEL</code> (see <code>.env.example</code>) in the{" "}
            <code>.env</code> file the app runs with and restart it.
          </p>
        )}
        <hr className="my-3" />

        {isLoading && <Spinner />}
        {!isLoading && entries.length === 0 && (
          <div className="text-center text-slate-400 py-10">
            No errors since the app started.
          </div>
        )}
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <ErrorCard
              key={entry.id}
              entry={entry}
              canExplain={data?.canExplain ?? false}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function ErrorCard({
  entry,
  canExplain,
}: {
  entry: ErrorLogEntry;
  canExplain: boolean;
}) {
  const explain = useExplainErrorMutation();
  const dismiss = useDismissErrorMutation();
  const url = itemUrl(entry);
  const explanation = entry.explanation ?? explain.data;

  return (
    <div
      className={
        "rounded-lg border p-3 " +
        (entry.resolved
          ? "border-slate-800 bg-slate-900/40 opacity-70"
          : "border-rose-900 bg-rose-950/20")
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="font-semibold text-slate-200">{entry.source}</div>
        {entry.context?.courseName && (
          <div className="text-slate-500 text-sm">{entry.context.courseName}</div>
        )}
        <div className="grow" />
        {entry.resolved && (
          <span className="text-xs font-bold text-green-400 border border-green-800 rounded px-1.5">
            fixed
          </span>
        )}
        <div className="text-slate-500 text-sm">
          {timeOf(entry.lastSeen)}
          {entry.count > 1 && ` · ${entry.count} times since ${timeOf(entry.firstSeen)}`}
        </div>
      </div>
      <pre className="whitespace-pre-wrap break-words text-sm text-rose-200 bg-gray-950/60 rounded p-2 mt-2">
        {entry.message}
      </pre>

      <div className="flex flex-wrap gap-2 mt-2">
        <button
          className="btn-thin disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => explain.mutate(entry.id)}
          disabled={!canExplain || explain.isPending || !!explanation}
          title={
            canExplain
              ? "Ask the AI what this error means and how to fix it"
              : "Needs AI_BASE_URL and AI_MODEL in the app's .env"
          }
        >
          {explain.isPending ? "Asking…" : "Explain with AI"}
        </button>
        {url && (
          <Link className="btn btn-thin unstyled btn-outline" to={url}>
            Open {entry.context?.itemType?.toLowerCase()}
          </Link>
        )}
        <button
          className="unstyled btn-thin btn-outline"
          onClick={() => dismiss.mutate(entry.id)}
          disabled={dismiss.isPending}
        >
          Dismiss
        </button>
        {explain.isPending && <Spinner />}
      </div>

      {explain.isError && (
        <div className="text-amber-300 text-sm mt-2">
          {getErrorMessage(explain.error)}
        </div>
      )}
      {explanation && (
        <div
          className="markdownPreview mt-3 border-t border-slate-800 pt-2 text-slate-300"
          dangerouslySetInnerHTML={{ __html: markdownToHtmlNoImages(explanation) }}
        />
      )}
    </div>
  );
}
