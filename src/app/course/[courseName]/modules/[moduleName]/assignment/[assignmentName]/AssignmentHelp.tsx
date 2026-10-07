"use client";
import { AssignmentSubmissionTypeList } from "@/features/local/assignments/models/assignmentSubmissionType";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import {
  C,
  Example,
  HelpLinks,
  HelpPanel,
  HelpSection,
  KeyList,
  P,
  ValueList,
} from "@/components/editor/help/HelpParts";
import {
  EncodedBlocksHelp,
  ImagesHelp,
  MarkdownBasicsHelp,
  MathHelp,
  MermaidHelp,
} from "@/components/editor/help/MarkdownHelpSections";

export function AssignmentHelp({
  settings,
  groupSetNames,
}: {
  settings: LocalCourseSettings;
  groupSetNames: string[];
}) {
  const groupNames = settings.assignmentGroups.map((g) => g.name);
  const exampleGroup = groupNames[0] ?? "Homework";
  const exampleGroupSet = groupSetNames[0] ?? "Project Teams";

  return (
    <HelpPanel>
      <HelpSection title="File layout">
        <P>
          Settings come first, then a <C>---</C> line, then the description in
          markdown. An optional <C>## Rubric</C> heading at the end starts the
          rubric.
        </P>
        <Example>{`
UnlockAt: 08/24/2026 00:00:00
LockAt: 09/04/2026 23:59:00
DueAt: 09/01/2026 23:59:00
AssignmentGroupName: ${exampleGroup}
SubmissionTypes:
- online_upload
AllowedFileUploadExtensions:
- pdf
---

What students should do, in markdown.

## Rubric

- 10pts: Program works
- 5pts: Code is readable
`}</Example>
        <P>
          Dates are <C>MM/DD/YYYY HH:MM:SS</C> (24-hour). With the cursor on a
          date line a calendar opens with class days and holidays marked;
          Escape hides it. <C>UnlockAt</C> and <C>LockAt</C> can be left blank.
        </P>
        <P>
          On a blank settings line, press <C>Ctrl+Space</C> for the settings
          you haven&apos;t used yet, and after a key for its allowed values.
        </P>
      </HelpSection>

      <HelpSection title="Settings">
        <KeyList
          items={[
            {
              name: "UnlockAt",
              children: "When students can see it. Blank = right away.",
            },
            {
              name: "DueAt",
              children: "Due date and time. Required.",
            },
            {
              name: "LockAt",
              children: "When submissions close. Blank = never.",
            },
            {
              name: "AssignmentGroupName",
              children: (
                <>
                  Grading category. This course has:{" "}
                  <ValueList
                    values={groupNames}
                    empty="no assignment groups yet (add them in course settings)"
                  />
                </>
              ),
            },
            {
              name: "SubmissionTypes",
              children: (
                <>
                  A list, one per line starting with <C>- </C>. Options:{" "}
                  <ValueList values={AssignmentSubmissionTypeList} empty="" />
                </>
              ),
            },
            {
              name: "AllowedFileUploadExtensions",
              children: (
                <>
                  A list of extensions (no dot) allowed for{" "}
                  <C>online_upload</C>. Empty = any file.
                </>
              ),
            },
            {
              name: "GroupSet / GradeIndividually",
              children: "Makes this a group assignment. See Group assignments.",
            },
            {
              name: "Schedule",
              children: "Different due dates for some students. See below.",
            },
            {
              name: "Classroom50Slug",
              children: "Links this assignment to Classroom 50. See below.",
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="Group assignments">
        <P>
          Name a Canvas group set to make this a group assignment. This
          course&apos;s group sets:{" "}
          <ValueList
            values={groupSetNames}
            empty="none in Canvas yet (create one on the Canvas People > Groups page, then sync in course settings)"
          />
        </P>
        <Example>{`
GroupSet: ${exampleGroupSet}
GradeIndividually: false
`}</Example>
        <P>
          <C>GradeIndividually: true</C> grades each member separately;{" "}
          <C>false</C> gives the whole group one grade.
        </P>
      </HelpSection>

      <HelpSection title="Per-student due dates (Schedule)">
        <P>
          Give some students a different due date (published as Canvas
          overrides). Students not listed keep <C>DueAt</C>.
        </P>
        <Example>{`
Schedule:
  09/18/2026:
    - 2986905
    - 2339770
  10/09/2026:
    - 2414797
`}</Example>
        <P>
          Type <C>- </C> under a date to pick from students not yet scheduled.
          The file stores each student&apos;s Canvas id (no names in the repo);
          the editor shows the name next to it.
        </P>
      </HelpSection>

      <HelpSection title="Rubric">
        <P>
          Each line under <C>## Rubric</C> is one criterion. Use <C>pt</C> for
          1 point and <C>pts</C> for more. Points possible is the total of the
          rows.
        </P>
        <Example>{`
## Rubric

- 1pt: Turned in on time
- 2.5pts: Decimals are fine
- 10pts: (extra credit) Not counted in points possible
- -5pts: Negative rows are deductions, also not counted
`}</Example>
        <P>
          <strong>Ratings (sub-scores):</strong> indent lines two spaces under
          a criterion so graders can pick a level instead of all-or-nothing.
          The criterion&apos;s own points are still the row maximum.
        </P>
        <Example>{`
- 10pts: Formatting
  - 10pts: proper margins, font size, spacing, and headings
  - 7pts: margins and font size correct, missing headings
  - 3pts: only paragraph spacing is acceptable
`}</Example>
        <P>
          Criteria without ratings become Full Marks / No Marks in Canvas.
        </P>
      </HelpSection>

      <HelpSection title="Classroom 50 accept link">
        <P>
          Set the slug in the settings, then put the token in the description.
          The accept url is built from the course&apos;s Classroom 50 settings
          plus the slug.
        </P>
        <Example>{`
Classroom50Slug: my-assignment-slug
---

[Accept the assignment](insert_classroom_url)
`}</Example>
        <P>
          The older <C>insert_github_classroom_url</C> token resolves to the
          same url.
        </P>
      </HelpSection>

      <MarkdownBasicsHelp />

      <HelpSection title="Links to other course files">
        <P>
          Link to a page, assignment, or quiz by its relative path to the
          <C>.md</C> file. In the preview it opens that item here; when
          publishing it is rewritten to the Canvas url.
        </P>
        <Example>{`
[Protocol spec](<../pages/Wire Protocol Spec.md>)
[Last week's lab](<../../02 Networking/assignments/Lab 2.md>)
`}</Example>
        <P>
          Paths are relative to this file, which lives in{" "}
          <C>&lt;module&gt;/assignments/</C>. Wrap paths with spaces in{" "}
          <C>&lt; &gt;</C>. Links to an assignment or quiz only resolve once
          that item is on Canvas; until then they are left as written.
        </P>
      </HelpSection>

      <ImagesHelp />
      <MathHelp />
      <MermaidHelp />
      <EncodedBlocksHelp />

      <HelpLinks
        links={[
          {
            href: "https://www.markdownguide.org/cheat-sheet/",
            label: "Markdown Cheat Sheet",
          },
          { href: "https://mermaid.live/edit", label: "Mermaid Live Editor" },
        ]}
      />
    </HelpPanel>
  );
}
