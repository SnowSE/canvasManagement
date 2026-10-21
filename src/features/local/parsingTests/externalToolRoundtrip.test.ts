import { describe, it, expect } from "vitest";
import { localAssignmentMarkdown } from "@/features/local/assignments/models/localAssignment";
import { AssignmentSubmissionType } from "@/features/local/assignments/models/assignmentSubmissionType";

describe("external_tool round trip", () => {
  it("parses and serializes external_tool", () => {
    const markdown = `LockAt: 08/26/2026 23:59:00
DueAt: 08/26/2026 23:59:00
AssignmentGroupName: Assignments
ExternalToolUrl: https://tool.example.edu/launch?x=1
SubmissionTypes:
- external_tool
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
    expect(parsed.submissionTypes).toEqual([
      AssignmentSubmissionType.EXTERNAL_TOOL,
    ]);
    expect(parsed.externalToolUrl).toBe("https://tool.example.edu/launch?x=1");
    const serialized = localAssignmentMarkdown.toMarkdown(parsed);
    expect(serialized).toContain("- external_tool");
    expect(serialized).toContain(
      "ExternalToolUrl: https://tool.example.edu/launch?x=1"
    );
  });

  it("writes no ExternalToolUrl line when there is none", () => {
    const parsed = localAssignmentMarkdown.parseMarkdown(
      `DueAt: 08/26/2026 23:59:00
SubmissionTypes:
- online_upload
---
`,
      "test-assignment"
    );
    expect(localAssignmentMarkdown.toMarkdown(parsed)).not.toContain(
      "ExternalToolUrl"
    );
  });
});
