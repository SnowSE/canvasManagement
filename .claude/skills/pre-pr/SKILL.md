---
name: pre-pr
description: The checks in canvasManagement and when to run them - the fast checks on every iteration, and once a feature looks done the browser walkthrough with its timings, a security review and the docs, before its PR. Use while iterating and before a PR.
---

# The order, for every change

1. A fast test that fails for the reason the change is for (a bug found in a
   browser run becomes such a test first, copying the real order of events).
2. The fix, until `scripts/check.sh` is green.
3. Onto the dev branch, and tell the owner what to try. He tries it there.
4. Only then, for the PR: the security review, the PR, the walkthrough and its
   timings (steps 2 to 5 below).

# The checks, and when

- **Every iteration** (each red/green/refactor step, each commit): step 1 only.
- **Once a feature looks done, before its PR**: steps 1 to 5, in order; stop at
  the first that fails and fix it first. Not on every small change: they take
  minutes.

## 1. Fast checks (about 17 s once the caches are warm)

```bash
scripts/check.sh        # tsc, eslint and vitest side by side, each timed; tsc and eslint cache in node_modules/.cache
```

Say the test count and the suite's time in the PR. If the suite got slower,
say why. Nothing slow (a browser, a server, the network) belongs in vitest:
those live in the walkthrough below.

## 2. The walkthrough, as a new user (about a minute; once the feature looks done)

```bash
.claude/skills/run-canvas-management/walkthrough/run.sh   # builds, serves a fresh copy of the walkthrough course and a fake Canvas on free ports
```

- Every line must be `PASS`. The fake Canvas (`fakeCanvas.mjs`) holds the
  course in memory, so items really are added, published and compared; a
  request it doesn't know fails a check by name, and the fix is usually a route
  in the fake, written as Canvas answers it. It stops its servers itself.
- It appends a line to `walkthrough/benchmarks.tsv` beside it: build size; the
  time until the course page is ready, an item opens, and typing is saved; and
  how many Canvas requests the course page, opening an item, and adding and
  publishing an item each make. On a real course every request is a round trip
  to Canvas, so a count that grows matters even when the fake's time doesn't.
  Commit that line with the change, and compare with the previous lines: a jump
  in any column needs an explanation in the PR or a fix.
- A change to something the walkthrough doesn't touch gets a new check in
  `walkthrough.mjs` (one line of what a user would see), not a screenshot.
- The walkthrough course (`walkthrough/course/`) is generic and
  invented: no course names, people, or real course content.

## 3. Security review (once per feature, before its PR)

Answer each in the PR's **Security** line, briefly; "none" is an answer.

- **New input** (a course file, an address, a Canvas response): how is it read,
  and can it reach the file system outside the course (paths with `..`,
  absolute paths), a shell, or `eval`?
- **New HTML shown**: sanitized (DOMPurify) or in the sandboxed preview route?
  Course files' own scripts must never run with the app's origin.
- **New server route or tRPC procedure**: does it go through the request guard
  (same-origin), and does it only read inside the course?
- **Canvas writes**: only on an explicit click? Could it publish or show
  something to students that the user didn't ask for?
- **Student data**: no names, emails or Canvas user ids in the repo, fixtures,
  logs or screenshots.
- **Secrets**: the Canvas token and `GH_TOKEN` never reach the browser, logs or
  error messages.
- **Dependencies**: any added? Say so, with why and its size.

## 4. Docs

Per CLAUDE.md: help panes, the handout section and a Recent changes row, in the
same PR.

## 5. Push

Fetch upstream first and rebase on it. Rewrite pushed history at most once per
PR. Bring the change onto the dev branch (`preview/local-work`) as well.
