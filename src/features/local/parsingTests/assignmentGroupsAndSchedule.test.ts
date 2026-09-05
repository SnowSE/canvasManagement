import { describe, it, expect } from "vitest";
import { LocalAssignment } from "../assignments/models/localAssignment";
import { AssignmentSubmissionType } from "../assignments/models/assignmentSubmissionType";
import { assignmentMarkdownSerializer } from "../assignments/models/utils/assignmentMarkdownSerializer";
import { assignmentMarkdownParser } from "../assignments/models/utils/assignmentMarkdownParser";

const base: LocalAssignment = {
  name: "Lightning Lab",
  description: "Present a 5-minute lightning talk",
  dueAt: "12/11/2026 23:59:00",
  lockAt: "12/11/2026 23:59:00",
  submissionTypes: [AssignmentSubmissionType.ONLINE_TEXT_ENTRY],
  localAssignmentGroupName: "Labs",
  rubric: [{ points: 10, label: "presented" }],
  allowedFileUploadExtensions: [],
};

describe("group set and schedule frontmatter", () => {
  it("round trips a group assignment", () => {
    const assignment: LocalAssignment = {
      ...base,
      groupSet: "Project Teams",
      gradeIndividually: true,
    };
    const markdown = assignmentMarkdownSerializer.toMarkdown(assignment);
    expect(markdown).toContain("GroupSet: Project Teams\nGradeIndividually: true");
    const parsed = assignmentMarkdownParser.parseMarkdown(markdown, base.name);
    expect(parsed).toEqual(assignment);
  });

  it("round trips a schedule", () => {
    const assignment: LocalAssignment = {
      ...base,
      schedule: [
        { date: "09/18/2026", students: ["Mccormick, Bradley", "Ginn, Landon"] },
        { date: "10/09/2026", students: ["Machaca, Leila"] },
      ],
    };
    const markdown = assignmentMarkdownSerializer.toMarkdown(assignment);
    expect(markdown).toContain(
      "Schedule:\n  09/18/2026:\n    - Mccormick, Bradley\n    - Ginn, Landon\n  10/09/2026:\n    - Machaca, Leila\n"
    );
    const parsed = assignmentMarkdownParser.parseMarkdown(markdown, base.name);
    expect(parsed).toEqual(assignment);
  });

  it("leaves files without the new fields unchanged", () => {
    const markdown = assignmentMarkdownSerializer.toMarkdown(base);
    expect(markdown).not.toContain("GroupSet");
    expect(markdown).not.toContain("GradeIndividually");
    expect(markdown).not.toContain("Schedule");
    const parsed = assignmentMarkdownParser.parseMarkdown(markdown, base.name);
    expect(parsed.groupSet).toBeUndefined();
    expect(parsed.gradeIndividually).toBeUndefined();
    expect(parsed.schedule).toBeUndefined();
  });

  it("parses a hand-written schedule with loose dates and blank lines", () => {
    const markdown = `UnlockAt: 
LockAt: 12/11/2026 23:59:00
DueAt: 12/11/2026 23:59:00
AssignmentGroupName: Labs
Schedule:
  9/18/2026:
    - Mccormick, Bradley

    - Hoyt, Jonathan (41015)
  10/09/2026:
Classroom50Slug: 
SubmissionTypes:
- online_text_entry
AllowedFileUploadExtensions:
---

description

## Rubric

- 10pts: presented`;
    const parsed = assignmentMarkdownParser.parseMarkdown(markdown, base.name);
    expect(parsed.schedule).toEqual([
      { date: "09/18/2026", students: ["Mccormick, Bradley", "Hoyt, Jonathan (41015)"] },
      { date: "10/09/2026", students: [] },
    ]);
    expect(parsed.submissionTypes).toEqual([AssignmentSubmissionType.ONLINE_TEXT_ENTRY]);
  });

  it("rejects a student that is not under a date", () => {
    const markdown = `DueAt: 12/11/2026 23:59:00
AssignmentGroupName: Labs
Schedule:
    - Mccormick, Bradley
SubmissionTypes:
---
d`;
    expect(() =>
      assignmentMarkdownParser.parseMarkdown(markdown, base.name)
    ).toThrow(/must be listed under a date/);
  });

  it("rejects a bad GradeIndividually value", () => {
    const markdown = `DueAt: 12/11/2026 23:59:00
AssignmentGroupName: Labs
GroupSet: Teams
GradeIndividually: maybe
SubmissionTypes:
---
d`;
    expect(() =>
      assignmentMarkdownParser.parseMarkdown(markdown, base.name)
    ).toThrow(/GradeIndividually/);
  });
});
