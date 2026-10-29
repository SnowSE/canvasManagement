import { describe, it, expect } from "vitest";
import { assignmentGroupOf, withAssignmentGroup } from "./assignmentGroupFiles";

const quiz = "ShuffleAnswers: true\nAssignmentGroup: Labs\nDescription: Labs again\n---\nAssignmentGroup: Labs\n";
const assignment = "Name: Lab 1\nAssignmentGroupName: Labs\nDueAt: 08/21/2023 23:59:00\n---\ntext\n";

describe("an item file's assignment group", () => {
  it("is read from a quiz's or an assignment's settings", () => {
    expect(assignmentGroupOf(quiz)).toBe("Labs");
    expect(assignmentGroupOf(assignment)).toBe("Labs");
    expect(assignmentGroupOf("Name: Page\n---\n")).toBeUndefined();
  });

  it("is changed in the settings only, leaving the same words in the body alone", () => {
    expect(withAssignmentGroup(quiz, "Labs", "Lab Work")).toBe(
      "ShuffleAnswers: true\nAssignmentGroup: Lab Work\nDescription: Labs again\n---\nAssignmentGroup: Labs\n",
    );
    expect(withAssignmentGroup(assignment, "Labs", "Lab Work")).toContain("AssignmentGroupName: Lab Work\n");
  });

  it("is left alone when it's another group", () => {
    expect(withAssignmentGroup(quiz, "Exams", "Lab Work")).toBe(quiz);
  });
});
