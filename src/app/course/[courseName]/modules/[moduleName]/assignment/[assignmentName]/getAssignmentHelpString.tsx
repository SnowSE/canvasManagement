"use client";
import { AssignmentSubmissionType } from "@/features/local/assignments/models/assignmentSubmissionType";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";

export function getAssignmentHelpString(
  settings: LocalCourseSettings,
  groupSetNames: string[] = []
) {
  const groupNames = settings.assignmentGroups.map((g) => g.name).join("\n- ");
  const groupSets =
    groupSetNames.length > 0
      ? groupSetNames.join("\n- ")
      : "(none in Canvas yet - create one on the Canvas People > Groups page, then sync in course settings)";
  const helpString = `
Assignment Group Names:
- ${groupNames}

Group Set Names (student groups, makes this a group assignment):
- ${groupSets}
GroupSet: Project Teams
GradeIndividually: false     (true = each member graded separately)

Schedule: per-student due dates (Canvas overrides). Students not listed
keep DueAt. Type "- " under a date to pick from students not yet scheduled;
the file stores each student's Canvas id (no names in the repo) and the
editor shows the name next to it.
Schedule:
  09/18/2026:
    - 2986905
    - 2339770
  10/09/2026:
    - 2414797

SubmissionTypes:
- ${AssignmentSubmissionType.ONLINE_TEXT_ENTRY}
- ${AssignmentSubmissionType.ONLINE_UPLOAD}
- ${AssignmentSubmissionType.DISCUSSION_TOPIC}
- ${AssignmentSubmissionType.ON_PAPER}
AllowedFileUploadExtensions:
- pdf
- jpg
- jpeg
- png
---

description goes here


## Markdown
You can use markdown to format your assignment description. For example, you can make lists like this:
- Item 1
- Item 2
- Item 3

**Bold text**

*Italic text*

[Link to Canvas](https://canvas.instructure.com)


\`Inline code\`

> Blockquote

---

1. First item
2. Second item
3. Third item

you can make mermaid diagrams like this:

\`\`\`mermaid
flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]
\`\`\`

## Encoded blocks

For a service that takes content in its url (a practice quiz, a diagram
renderer), name a fenced block and reference it from a link or image with
{{name:encoding}}. The block stays readable here; the encoded value is
substituted when publishing. Add "hide" to keep the block itself off the page.

Take the [practice quiz](https://teichert.github.io/quizhub/?t={{pq:base64}}) first.

\`\`\`\`quiztext encoded-name=pq hide
Points: 1000
---
What does this print?
\`\`\`c#
Console.Write('h');
Console.Write('i');
\`\`\`

*a) hi
b) Compile error
\`\`\`\`

Note the four backticks: the outer fence needs MORE backticks than any fence
inside it, or the first inner \`\`\` ends the block early and the rest of the
quiz (answers included) gets published onto the page.

Encodings are base64, pako (compressed, for much shorter urls) and urlencoded.
The encoding is chosen where it is used, so one block can feed several links.
"hide" works on any fenced block, with or without a name.

## LaTeX Math

**Inline math:** The Fibonacci sequence is defined as: $F(n) = F(n-1) + F(n-2)$ where $F(0) = 0$ and $F(1) = 1$.

**Block math:**
$$F(n) = F(n-1) + F(n-2)$$

**Complex equations:**
$$
F(n) = \\begin{cases} 
0 & \\text{if } n = 0 \\\\
1 & \\text{if } n = 1 \\\\
F(n-1) + F(n-2) & \\text{if } n > 1
\\end{cases}
$$

## classroom links are derived from the course's Classroom 50 settings + this assignment's Classroom50Slug

Classroom50Slug: my-assignment-slug (goes in the settings block above the ---)

[Accept the assignment](insert_classroom_url)

(the legacy insert_github_classroom_url token also resolves to the same url)

## Files

If you have mounted a folder in the /app/public/images directory, you can link to files like this:

![formulas](/images/facultyFiles/1405/lab-04-simple-math-formulas.png)

## Rubric

Each rubric item is a grading criterion worth a certain number of points.
Use "pt" for 1 point and "pts" for multiple points.

- 1pt: singular point
- 2pts: plural points
- 10pts: (extra credit) extra credit points
- 10pts: (Extra Credit) Caps also works

### Sub-scores (ratings)

Indent items under a criterion with two spaces to define ratings (sub-scores).
Ratings let graders choose a specific level instead of all-or-nothing grading.
The criterion's top-level points value is still the maximum for that row.

Example — formatting worth 10 points:

- 10pts: Formatting
  - 10pts: proper margins, font size, spacing, contrast, and headings
  - 7pts: margins and font size correct but missing heading styles
  - 3pts: only paragraph spacing is acceptable

Example — reading response worth 5 points:

- 5pts: Student response to reading
  - 5pts: thoughtful, thorough analysis of pros and cons
  - 3pts: multiple sentences of relevant content
  - 1pt: submitted something

Criteria without sub-scores default to Full Marks / No Marks in Canvas.`;
  return helpString;
}
