import { describe, it, expect } from "vitest";
import { localAssignmentMarkdown } from "@/features/local/assignments/models/localAssignment";
import { AssignmentSubmissionType } from "@/features/local/assignments/models/assignmentSubmissionType";

describe("on_paper round trip", () => {
  it("parses and serializes on_paper", () => {
    const markdown = `Name: test-assignment
LockAt: 08/26/2026 23:59:00
DueAt: 08/26/2026 23:59:00
AssignmentGroupName: Assignments
SubmissionTypes:
- on_paper
AllowedFileUploadExtensions:
---

description here

## Rubric
- 2pts: does it work
`;
    const parsed = localAssignmentMarkdown.parseMarkdown(
      markdown,
      "test-assignment"
    );
    console.log("parsed submissionTypes:", parsed.submissionTypes);
    expect(parsed.submissionTypes).toContain(
      AssignmentSubmissionType.ON_PAPER
    );
    const serialized = localAssignmentMarkdown.toMarkdown(parsed);
    console.log("serialized:\n", serialized);
    expect(serialized).toContain("- on_paper");
    expect(serialized.length).toBeGreaterThan(50);
  });
});
