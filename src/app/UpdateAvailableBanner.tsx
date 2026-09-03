"use client";
import { useState } from "react";
import { useVersionStatusQuery } from "@/features/local/version/versionHooks";

export default function UpdateAvailableBanner() {
  const { data: status } = useVersionStatusQuery();
  const [expanded, setExpanded] = useState(false);

  if (!status || status.kind !== "update-available") return null;

  const { running, published, commits, aheadBy, compareUrl } = status;
  const count = aheadBy ?? commits.length;
  const countLabel =
    count > 0 ? `${count} new ${count === 1 ? "commit" : "commits"}` : "";

  return (
    <div className="border border-amber-700/60 bg-amber-950/40 text-amber-100 rounded-md mb-4">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-semibold">
            A newer Canvas Manager image is available
          </span>
          {countLabel && (
            <span className="text-amber-300/80 text-sm">· {countLabel}</span>
          )}
        </span>
        <span className="text-amber-300/80 text-sm">
          {expanded ? "hide" : "what's new"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 text-sm">
          <div className="text-amber-200/70 mb-2">
            Running{" "}
            <code className="font-mono">
              {running.image}:{running.tag}
            </code>{" "}
            at <code className="font-mono">{running.shortSha}</code>, published
            is <code className="font-mono">{published.shortSha}</code>
            {published.buildDate && (
              <> ({new Date(published.buildDate).toLocaleString()})</>
            )}
            .
          </div>

          {commits.length > 0 ? (
            <ul className="list-disc ml-5 space-y-1 mb-3">
              {commits.map((c) => (
                <li key={c.sha}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-amber-300/80 hover:underline mr-2"
                  >
                    {c.shortSha}
                  </a>
                  <span className="text-slate-200">{c.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mb-3 text-amber-200/70">
              Commit list unavailable, see the{" "}
              <a
                href={compareUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                comparison on GitHub
              </a>
              .
            </div>
          )}

          <div className="text-amber-200/70">
            To update, run your reset script (or{" "}
            <code className="font-mono">
              docker compose pull && docker compose up -d
            </code>{" "}
            in your runtime folder). See the{" "}
            <a
              href={compareUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              full diff
            </a>
            .
          </div>
        </div>
      )}
    </div>
  );
}
