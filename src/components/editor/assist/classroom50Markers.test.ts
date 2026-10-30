import { describe, it, expect } from "vitest";
import { classroom50SlugWithoutAcceptLink } from "./classroom50Markers";

const assignment = (slug: string, body: string) =>
  `DueAt: 12/11/2026 23:59:00
AssignmentGroupName: Labs
Classroom50Slug: ${slug}
SubmissionTypes:
- online_text_entry
---

${body}

## Rubric

- 10pts: Works`.split("\n");

describe("classroom50SlugWithoutAcceptLink", () => {
  it("points at the slug when the description has no accept link", () => {
    expect(
      classroom50SlugWithoutAcceptLink(assignment("lab-3", "Build the server."))
    ).toEqual({ lineIndex: 2, column: 18, slug: "lab-3" });
  });

  it("is satisfied by the token, the legacy token or the url itself", () => {
    for (const body of [
      "[Accept the assignment](insert_classroom_url)",
      "[Accept](insert_github_classroom_url)",
      "https://classroom50.org/org/cs-101/assignments/lab-3/accept",
    ])
      expect(
        classroom50SlugWithoutAcceptLink(assignment("lab-3", body))
      ).toBeUndefined();
  });

  it("ignores another assignment's accept url", () => {
    expect(
      classroom50SlugWithoutAcceptLink(
        assignment("lab-3", "https://classroom50.org/org/cs-101/assignments/lab-2/accept")
      )
    ).toBeDefined();
  });

  it("says nothing without a slug or a settings block", () => {
    expect(
      classroom50SlugWithoutAcceptLink(assignment("", "Build the server."))
    ).toBeUndefined();
    expect(
      classroom50SlugWithoutAcceptLink(["Classroom50Slug: lab-3", "no divider"])
    ).toBeUndefined();
  });
});
