# canvasManagement

Edits Canvas LMS course content stored as markdown on disk. To run, screenshot
or test the app, use the `run-canvas-management` skill
(`.claude/skills/run-canvas-management/SKILL.md`).

## Keep the docs current

Every change that a user can see (a new feature, new syntax, a changed button,
a changed workflow) updates the docs **in the same commit or PR**. A feature is
not done until the docs describe it.

What to update:

- **The editor help panes** when file syntax changes:
  `AssignmentHelp.tsx`, `QuizHelp.tsx` and the shared topics in
  `src/components/editor/help/MarkdownHelpSections.tsx`. Examples there must
  parse with the real parsers.
- **The handouts in `docs/`**:
  - `docs/getting-started.html`: the main guide. Update the section the
    feature belongs to, and add a row to **Recent changes** at the bottom
    (month, one sentence).
  - A feature big enough to need its own walkthrough gets its own handout
    (like `docs/group-assignments-and-student-schedules.html`). Link it from
    getting-started, from Recent changes and from the README's Handouts list.
  - Bump the "updated <Month YYYY>" in the header eyebrow of any handout you
    change.
- **`README.md`** when setup, deployment or the list of handouts changes.

### Handout screenshots

The handouts are single self-contained HTML files: screenshots are embedded as
base64 so a handout can be emailed or attached whole. Use
`scripts/docs_images.py`:

```bash
python3 scripts/docs_images.py extract docs/getting-started.html /tmp/imgs  # see what's there
# write a new screenshot, point an <img> at it with src="embed:/path/shot.png", then:
python3 scripts/docs_images.py embed docs/getting-started.html
```

- Take screenshots with the playwright container from the run skill at
  1500x1000, with `timezoneId: "America/Denver"` (the container is UTC, which
  shifts every date and invents differences on the compare page).
- **Never show real student data.** No real names, emails or Canvas user ids
  in screenshots or examples; the repo is public. Use the invented roster the
  handouts already use (Priya Anand, Owen Brennan, ... `@example.edu`, ids
  100201+), e.g. by intercepting the `roster.*` tRPC calls in playwright.
- Give every image a descriptive `alt` and a `figcaption`.
- Open the handout in the browser afterwards and check that nothing is broken.

## Student data

Course files store students by Canvas id only; names are resolved at render
time. Never write student names into repo files, fixtures or docs.
