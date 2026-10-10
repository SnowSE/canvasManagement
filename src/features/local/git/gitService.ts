import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { getCoursePathByName } from "../globalSettings/globalSettingsFileStorageService";
import { itemFilePath } from "../course/courseItemFileStorageService";
import { CourseItemType } from "../course/courseItemTypes";
import { logError } from "../errorLog/errorLogStore";
import { GitChange, parsePorcelain, suggestCommitMessage } from "./gitChangeSummary";

const execFileAsync = promisify(execFile);

// The course files are usually a git repository the instructor also uses from
// the host, so the container's uid may not own it; safe.directory=* stops git
// refusing to touch it. Nothing here ever runs a command that discards work.
const baseArgs = ["-c", "safe.directory=*"];

// The container has no ssh keys, but it does have gh and GH_TOKEN for Classroom
// 50, so GitHub remotes written as ssh are reached over https with gh's token.
const networkArgs = async () => {
  if (!process.env.GH_TOKEN) return [];
  const hasSshKey = await fs
    .readdir(path.join(os.homedir(), ".ssh"))
    .then((files) => files.some((f) => f.startsWith("id_")))
    .catch(() => false);
  if (hasSshKey) return [];
  return [
    "-c", "credential.helper=",
    "-c", "credential.helper=!gh auth git-credential",
    "-c", "url.https://github.com/.insteadOf=git@github.com:",
    "-c", "url.https://github.com/.insteadOf=ssh://git@github.com/",
  ];
};

const runGit = async (
  cwd: string,
  args: string[],
  { network = false }: { network?: boolean } = {},
) => {
  try {
    const { stdout } = await execFileAsync(
      "git",
      [...baseArgs, ...(network ? await networkArgs() : []), ...args],
      {
        cwd,
        maxBuffer: 50 * 1024 * 1024,
        timeout: network ? 120_000 : 30_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
    );
    return stdout;
  } catch (e) {
    const error = e as { stderr?: string; message: string };
    const stderr = (error.stderr ?? "")
      .split("\n")
      .filter((line) => !line.startsWith("hint:"))
      .join("\n")
      .trim();
    throw new Error(stderr || error.message, { cause: e });
  }
};

const courseDirectory = async (courseName: string) =>
  path.resolve(await getCoursePathByName(courseName));

const repoRoot = async (directory: string) =>
  (await runGit(directory, ["rev-parse", "--show-toplevel"])).trim();

export interface GitCourseStatus {
  available: true;
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  changes: GitChange[];
  suggestedMessage: string;
  lastCommit?: { shortSha: string; subject: string; date: string };
  identity: { name?: string; email?: string };
  lastFetch?: string;
}

export type GitStatusResult =
  | GitCourseStatus
  | { available: false; reason: string };

const configValue = (cwd: string, key: string) =>
  runGit(cwd, ["config", key]).then(
    (v) => v.trim() || undefined,
    () => undefined,
  );

// fetch in the background at most this often, so ahead/behind stays current
const fetchInterval = 10 * 60 * 1000;
const fetchesInFlight = new Map<string, Promise<unknown>>();

const fetchInBackground = async (root: string) => {
  if (fetchesInFlight.has(root)) return;
  const fetchHead = path.join(root, ".git", "FETCH_HEAD");
  const lastFetch = await fs.stat(fetchHead).then((s) => s.mtimeMs, () => 0);
  if (Date.now() - lastFetch < fetchInterval) return;
  const fetching = runGit(root, ["fetch", "--quiet"], { network: true })
    .catch((e) =>
      logError({
        key: `git-fetch:${root}`,
        source: "Checking the course repository's remote for new commits",
        message: e.message,
      }),
    )
    .finally(() => fetchesInFlight.delete(root));
  fetchesInFlight.set(root, fetching);
};

export const gitService = {
  async status(courseName: string): Promise<GitStatusResult> {
    const directory = await courseDirectory(courseName);
    let root: string;
    try {
      root = await repoRoot(directory);
    } catch (e) {
      return {
        available: false,
        reason: `The course folder is not in a git repository (${(e as Error).message})`,
      };
    }
    const courseFromRoot = path.relative(root, directory);

    const [porcelain, branch, upstream, lastCommitLine, name, email] =
      await Promise.all([
        runGit(directory, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "."]),
        runGit(directory, ["rev-parse", "--abbrev-ref", "HEAD"]).then((b) => b.trim()),
        runGit(directory, ["rev-parse", "--abbrev-ref", "@{upstream}"]).then(
          (u) => u.trim() || undefined,
          () => undefined,
        ),
        runGit(directory, ["log", "-1", "--format=%h%x00%s%x00%cI", "--", "."]).catch(() => ""),
        configValue(directory, "user.name"),
        configValue(directory, "user.email"),
      ]);

    let ahead = 0;
    let behind = 0;
    if (upstream) {
      const counts = await runGit(directory, [
        "rev-list", "--left-right", "--count", "HEAD...@{upstream}",
      ]).catch(() => "0 0");
      [ahead, behind] = counts.trim().split(/\s+/).map(Number);
      fetchInBackground(root);
    }

    const changes = parsePorcelain(porcelain).map((c) => ({
      ...c,
      path: path.relative(courseFromRoot, c.path).split(path.sep).join("/"),
    }));
    const [shortSha, subject, date] = lastCommitLine.trim().split("\0");
    const lastFetch = await fs
      .stat(path.join(root, ".git", "FETCH_HEAD"))
      .then((s) => s.mtime.toISOString(), () => undefined);

    return {
      available: true,
      branch,
      upstream,
      ahead,
      behind,
      changes,
      suggestedMessage: suggestCommitMessage(courseName, changes),
      lastCommit: shortSha ? { shortSha, subject, date } : undefined,
      identity: { name, email },
      lastFetch,
    };
  },

  /** Commits this course's folder only, whatever else is changed in the repo. */
  async commit(courseName: string, message: string) {
    const directory = await courseDirectory(courseName);
    if (!(await configValue(directory, "user.name")) || !(await configValue(directory, "user.email")))
      throw new Error("Set your name and email for commits first.");
    await runGit(directory, ["add", "-A", "--", "."]);
    const staged = await runGit(directory, ["diff", "--cached", "--name-only", "--", "."]);
    if (!staged.trim()) throw new Error("Nothing in this course to commit.");
    await runGit(directory, ["commit", "--quiet", "-m", message, "--", "."]);
    return (await runGit(directory, ["rev-parse", "--short", "HEAD"])).trim();
  },

  async setIdentity(courseName: string, name: string, email: string) {
    const directory = await courseDirectory(courseName);
    await runGit(directory, ["config", "--global", "user.name", name]);
    await runGit(directory, ["config", "--global", "user.email", email]);
  },

  /**
   * Pulls, then pushes. When both sides have new commits they are merged, as
   * long as git can do it without a conflict; on a conflict the merge is
   * aborted, leaving everything as it was, and the files are named for the
   * instructor to sort out in a terminal. Never rebases or discards anything.
   */
  async sync(courseName: string) {
    const directory = await courseDirectory(courseName);
    const root = await repoRoot(directory);
    const before = (await runGit(root, ["rev-parse", "HEAD"])).trim();
    await runGit(root, ["fetch", "--quiet"], { network: true });
    let merged = false;
    try {
      await runGit(root, ["merge", "--ff-only", "--quiet", "@{upstream}"]);
    } catch {
      try {
        await runGit(root, ["merge", "--no-edit", "--quiet", "@{upstream}"]);
        merged = true;
      } catch (mergeError) {
        const conflicted = (
          await runGit(root, ["diff", "--name-only", "--diff-filter=U"]).catch(() => "")
        ).trim();
        const mergeHead = await fs
          .access(path.join(root, ".git", "MERGE_HEAD"))
          .then(() => true, () => false);
        if (mergeHead) await runGit(root, ["merge", "--abort"]);
        throw new Error(
          conflicted
            ? `Your commits and the remote's both changed the same lines, so nothing was merged. Merge in a terminal (git pull), resolving: ${conflicted.split("\n").join(", ")}`
            : `Could not merge the remote's commits, so nothing was changed: ${(mergeError as Error).message}`,
          { cause: mergeError },
        );
      }
    }
    const pulled = Number(
      (await runGit(root, ["rev-list", "--count", `${before}..HEAD`])).trim(),
    );
    const ahead = Number(
      (await runGit(root, ["rev-list", "--count", "@{upstream}..HEAD"])).trim(),
    );
    if (ahead > 0) await runGit(root, ["push", "--quiet"], { network: true });
    return { pulled, pushed: ahead, merged };
  },

  /** Commits that touched one item's file, following renames, newest first. */
  async itemHistory(item: ItemRef) {
    const filePath = path.resolve(await itemFilePath(item));
    const root = await repoRoot(path.dirname(filePath));
    const relative = path.relative(root, filePath);
    const log = await runGit(root, [
      "log", "--follow", "-n", "100", "--name-only",
      "--format=%x1e%H%x00%h%x00%an%x00%cI%x00%s", "--", relative,
    ]).catch(() => "");
    const commits = log
      .split("\x1e")
      .filter((record) => record.trim())
      .map((record) => {
        const [header, ...rest] = record.trim().split("\n");
        const [sha, shortSha, author, date, subject] = header.split("\0");
        const pathAtCommit = rest.map((l) => l.trim()).filter(Boolean).pop() ?? relative;
        return { sha, shortSha, author, date, subject, path: pathAtCommit };
      });
    const dirty = (
      await runGit(root, ["status", "--porcelain=v1", "--", relative])
    ).trim().length > 0;
    return { commits, uncommittedChanges: dirty };
  },

  async itemAtCommit(item: ItemRef, sha: string, pathAtCommit: string) {
    const filePath = path.resolve(await itemFilePath(item));
    const root = await repoRoot(path.dirname(filePath));
    return await runGit(root, ["show", `${sha}:${pathAtCommit}`]).catch(
      () => "",
    );
  },

  /** Writes an earlier version over the file. The current text stays in git's history only if it was committed. */
  async restoreItem(item: ItemRef, sha: string, pathAtCommit: string) {
    const filePath = path.resolve(await itemFilePath(item));
    const root = await repoRoot(path.dirname(filePath));
    const text = await runGit(root, ["show", `${sha}:${pathAtCommit}`]);
    await fs.writeFile(filePath, text);
  },
};

export interface ItemRef {
  courseName: string;
  moduleName: string;
  type: CourseItemType;
  name: string;
}
