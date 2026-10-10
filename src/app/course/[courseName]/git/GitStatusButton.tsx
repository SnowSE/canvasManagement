"use client";
import { useEffect, useState } from "react";
import Modal, { useModal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import {
  useGitCommitMutation,
  useGitSetIdentityMutation,
  useGitStatusQuery,
  useGitSyncMutation,
  useSetCommitOnPublishMutation,
} from "@/features/local/git/gitHooks";
import type { GitCourseStatus } from "@/features/local/git/gitService";
import { describePath, GitChangeKind } from "@/features/local/git/gitChangeSummary";
import { getErrorMessage } from "@/services/utils/queryClient";
import { useCourseContext } from "../context/courseContext";

/** Header button showing the course folder's git state; opens commit and sync. */
export function GitStatusButton() {
  const { data } = useGitStatusQuery();
  const modal = useModal();
  if (!data?.status.available) return null;
  const { status } = data;
  const changed = status.changes.length;

  return (
    <Modal
      modalControl={modal}
      modalWidth="w-[40rem]"
      buttonComponent={({ openModal }) => (
        <button
          className="unstyled btn-outline flex items-center gap-2 whitespace-nowrap"
          onClick={openModal}
          title="Commit this course's changes to git, and pull or push"
        >
          {changed > 0 ? (
            <>
              <span className="size-2 rounded-full bg-amber-400" aria-hidden />
              {changed} uncommitted
            </>
          ) : (
            <span className="text-slate-400">Committed</span>
          )}
          {status.ahead > 0 && (
            <span className="text-sky-300" title={`${status.ahead} commit(s) to push`}>
              ↑{status.ahead}
            </span>
          )}
          {status.behind > 0 && (
            <span className="text-amber-300" title={`${status.behind} commit(s) to pull`}>
              ↓{status.behind}
            </span>
          )}
        </button>
      )}
    >
      {({ closeModal }) => (
        <GitPanel
          status={status}
          commitOnPublish={data.commitOnPublish}
          onClose={closeModal}
        />
      )}
    </Modal>
  );
}

const kindStyles: Record<GitChangeKind, string> = {
  added: "text-green-400",
  edited: "text-amber-300",
  deleted: "text-rose-400",
  renamed: "text-sky-300",
};

const timeAgo = (iso?: string) => {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleDateString();
};

function GitPanel({
  status,
  commitOnPublish,
  onClose,
}: {
  status: GitCourseStatus;
  commitOnPublish: boolean;
  onClose: () => void;
}) {
  const { courseName } = useCourseContext();
  const commit = useGitCommitMutation();
  const sync = useGitSyncMutation();
  const setCommitOnPublish = useSetCommitOnPublishMutation();
  const [message, setMessage] = useState(status.suggestedMessage);
  const [edited, setEdited] = useState(false);

  // follow the suggestion as files change, until the message is edited
  useEffect(() => {
    if (!edited) setMessage(status.suggestedMessage);
  }, [edited, status.suggestedMessage]);

  const needsIdentity = !status.identity.name || !status.identity.email;

  return (
    <div className="flex flex-col gap-3 text-slate-300">
      <div className="flex items-baseline justify-between gap-2">
        <h4>Course files in git</h4>
        <div className="text-sm text-slate-500">
          {status.branch}
          {status.upstream ? ` → ${status.upstream}` : " (no remote)"}
        </div>
      </div>

      {needsIdentity && <IdentityForm />}

      <div>
        <div className="font-semibold mb-1">
          {status.changes.length === 0
            ? "No uncommitted changes in this course."
            : `${status.changes.length} uncommitted change${status.changes.length === 1 ? "" : "s"} in this course`}
        </div>
        <ul className="max-h-48 overflow-y-auto text-sm">
          {status.changes.map((c) => (
            <li key={c.path} className="flex gap-2">
              <span className={`w-16 flex-none ${kindStyles[c.kind]}`}>{c.kind}</span>
              <span title={c.path}>{describePath(c.path)}</span>
            </li>
          ))}
        </ul>
      </div>

      {status.changes.length > 0 && (
        <>
          <label className="text-sm text-slate-400" htmlFor="git-message">
            Commit message
          </label>
          <textarea
            id="git-message"
            className="bg-gray-950 border border-slate-700 rounded p-2 text-sm font-mono h-28"
            value={message}
            onChange={(e) => {
              setEdited(true);
              setMessage(e.target.value);
            }}
          />
          <div className="flex items-center gap-2">
            <button
              className="disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={needsIdentity || !message.trim() || commit.isPending}
              onClick={() =>
                commit.mutate(
                  { courseName, message },
                  { onSuccess: () => setEdited(false) },
                )
              }
            >
              {commit.isPending ? "Committing…" : "Commit"}
            </button>
            {commit.isPending && <Spinner />}
            {commit.isSuccess && (
              <span className="text-green-400 text-sm">Committed {commit.data}</span>
            )}
          </div>
          {commit.isError && (
            <div className="text-amber-300 text-sm">{getErrorMessage(commit.error)}</div>
          )}
        </>
      )}

      {status.upstream && (
        <div className="border-t border-slate-700 pt-3 flex flex-col gap-2">
          <div className="text-sm">
            {status.ahead === 0 && status.behind === 0
              ? "Up to date with the remote"
              : [
                  status.ahead > 0 && `${status.ahead} commit${status.ahead === 1 ? "" : "s"} to push`,
                  status.behind > 0 && `${status.behind} to pull`,
                ]
                  .filter(Boolean)
                  .join(", ")}
            <span className="text-slate-500"> · checked {timeAgo(status.lastFetch)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="unstyled btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={sync.isPending}
              onClick={() => sync.mutate(courseName)}
              title="Gets the remote's commits, merging if both sides changed, then pushes yours"
            >
              {sync.isPending ? "Syncing…" : "Pull and push"}
            </button>
            {sync.isPending && <Spinner />}
            {sync.isSuccess && (
              <span className="text-green-400 text-sm">
                Pulled {sync.data.pulled}
                {sync.data.merged && " (merged)"}, pushed {sync.data.pushed}
              </span>
            )}
          </div>
          {sync.isError && (
            <div className="text-amber-300 text-sm whitespace-pre-wrap">
              {getErrorMessage(sync.error)}
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm border-t border-slate-700 pt-3">
        <input
          type="checkbox"
          checked={commitOnPublish}
          disabled={setCommitOnPublish.isPending}
          onChange={(e) => setCommitOnPublish.mutate(e.target.checked)}
        />
        Commit automatically after adding or updating something in Canvas
      </label>

      {status.lastCommit && (
        <div className="text-sm text-slate-500">
          Last commit to this course: {status.lastCommit.shortSha}{" "}
          &ldquo;{status.lastCommit.subject}&rdquo;, {timeAgo(status.lastCommit.date)}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Only this course&rsquo;s folder is committed. When you and the remote
        both have new commits they are merged, unless they change the same
        lines: then nothing is merged and you sort it out in a terminal.
      </p>
      <div className="flex justify-end">
        <button className="unstyled btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function IdentityForm() {
  const { courseName } = useCourseContext();
  const setIdentity = useGitSetIdentityMutation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form
      className="flex flex-col gap-2 rounded border border-amber-800 bg-amber-950/20 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setIdentity.mutate({ courseName, name, email });
      }}
    >
      <div className="text-sm">
        Git needs a name and email to put on your commits. This is saved in
        the app&rsquo;s git config, not in the course files.
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className="bg-gray-950 border border-slate-700 rounded px-2 py-1 grow"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="bg-gray-950 border border-slate-700 rounded px-2 py-1 grow"
          placeholder="you@example.edu"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="disabled:opacity-50"
          disabled={!name.trim() || !email.trim() || setIdentity.isPending}
        >
          Save
        </button>
      </div>
      {setIdentity.isError && (
        <div className="text-amber-300 text-sm">{getErrorMessage(setIdentity.error)}</div>
      )}
    </form>
  );
}
