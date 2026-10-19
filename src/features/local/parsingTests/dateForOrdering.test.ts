import { describe, it, expect } from "vitest";
import { assignmentMarkdownSerializer } from "../assignments/models/utils/assignmentMarkdownSerializer";
import { assignmentMarkdownParser } from "../assignments/models/utils/assignmentMarkdownParser";
import { quizMarkdownUtils } from "../quizzes/models/utils/quizMarkdownUtils";
import { LocalAssignment } from "../assignments/models/localAssignment";
import { byOrderingDate } from "../modules/moduleItemOrder";

const assignment: LocalAssignment = {
  name: "Lab 1",
  description: "do it",
  dueAt: "09/04/2026 23:59:00",
  unlockAt: "08/31/2026 00:00:00",
  localAssignmentGroupName: "Labs",
  submissionTypes: [],
  allowedFileUploadExtensions: [],
  rubric: [],
};

const quiz = `UnlockAt: 08/31/2026 00:00:00
LockAt: 
DueAt: 09/04/2026 23:59:00
DueDateForOrdering: 09/04/2026 23:59:00
Password: 
ShuffleAnswers: true
ShowCorrectAnswers: true
OneQuestionAtATime: false
AssignmentGroup: Quizzes
AllowedAttempts: -1
Description: practice
---
What is 1+1?
a) 1
*b) 2`;

describe("DateForOrdering on assignments and quizzes", () => {
  it("round-trips on an assignment, written only when set", () => {
    const ordered = { ...assignment, dateForOrdering: "09/04/2026 23:59:00" };
    const markdown = assignmentMarkdownSerializer.toMarkdown(ordered);

    expect(markdown).toContain("DateForOrdering: 09/04/2026 23:59:00\n");
    expect(assignmentMarkdownParser.parseMarkdown(markdown, "Lab 1")).toEqual(ordered);
    expect(assignmentMarkdownSerializer.toMarkdown(assignment)).not.toContain(
      "ForOrdering"
    );
  });

  it("round-trips on a quiz, written only when set", () => {
    const parsed = quizMarkdownUtils.parseMarkdown(quiz, "Quiz 1");

    expect(parsed.dateForOrdering).toBe("09/04/2026 23:59:00");
    expect(quizMarkdownUtils.toMarkdown(parsed)).toContain(
      "\nDateForOrdering: 09/04/2026 23:59:00\n"
    );
    expect(
      quizMarkdownUtils.toMarkdown({ ...parsed, dateForOrdering: undefined })
    ).not.toContain("ForOrdering");
  });

  it("orders ahead of the available date, so due-date order can be kept", () => {
    const quizDueFirst = { name: "quiz", dueAt: "09/02/2026 23:59:00" };
    const byDueDate = { ...assignment, dateForOrdering: assignment.dueAt };

    // Lab 1 opens 8/31, so it comes first unless told to order by its 9/4 due date
    expect([quizDueFirst, assignment].sort(byOrderingDate).map((i) => i.name)).toEqual([
      "Lab 1",
      "quiz",
    ]);
    expect([quizDueFirst, byDueDate].sort(byOrderingDate).map((i) => i.name)).toEqual([
      "quiz",
      "Lab 1",
    ]);
  });

  it("reads the older name DueDateForOrdering and writes DateForOrdering", () => {
    const parsed = quizMarkdownUtils.parseMarkdown(quiz, "Quiz 1");
    const written = quizMarkdownUtils.toMarkdown(parsed);

    expect(quiz).toContain("DueDateForOrdering:");
    expect(written).toContain("\nDateForOrdering: 09/04/2026 23:59:00\n");
    expect(written).not.toContain("DueDateForOrdering");
  });

  it("falls back to when an item closes when it has no other date", () => {
    const closes = { name: "closes", dueAt: "", lockAt: "09/01/2026 00:00:00" };
    const due = { name: "due", dueAt: "09/02/2026 00:00:00" };

    expect([due, closes].sort(byOrderingDate).map((i) => i.name)).toEqual(["closes", "due"]);
  });
});
