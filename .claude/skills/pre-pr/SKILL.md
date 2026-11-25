---
name: pre-pr
description: The checks every change goes through before it is pushed or a PR is opened in canvasManagement - fast checks, the browser walkthrough with its timings, a security review and the docs. Use before every push, PR or force-push.
---

# Before a push or PR

Run these in order; stop at the first that fails and fix it first.

## 1. Fast checks (under a minute)

```bash
scripts/check.sh        # tsc, eslint, vitest, each timed
```

Say the test count and the suite's time in the PR. If the suite got slower,
say why. Nothing slow (a browser, a server, the network) belongs in vitest:
those live in the walkthrough below.

## 2. The walkthrough, as a new user (a few minutes)

```bash
scripts/walkthrough/run.sh   # builds, serves a fresh copy of the walkthrough course on :3002, Canvas stubbed
```

- Every line must be `PASS`. It also stops its server; confirm with
  `ss -ltn | grep :3002` (nothing).
- It appends the timings (build size, course page ready, item open, save after
  typing) to `scripts/benchmarks.tsv`. Commit that line with the change, and
  compare with the previous lines: a jump in any column needs an explanation in
  the PR or a fix.
- A change to something the walkthrough doesn't touch gets a new check in
  `walkthrough.mjs` (one line of what a user would see), not a screenshot.
- The walkthrough course (`scripts/walkthrough/course/`) is generic and
  invented: no course names, people, or real course content.

## 3. Security review (every PR)

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
