import { describe, it, expect } from "vitest";
import {
  getLineContext,
  itemTypeFromFrontmatter,
  presentKeys,
  scheduleStudentLines,
} from "./frontmatterContext";

const file = `UnlockAt: 
LockAt: 12/11/2026 23:59:00
DueAt: 12/11/2026 23:59:00
AssignmentGroupName: Labs
GroupSet:
Schedule:
  09/18/2026:
    - Mccormick, Bradley
    - 
  
    
  10/09/2026
Classroom50Slug: 

SubmissionTypes:
- online_text_entry
- 
---

body with - dashes
Key: not frontmatter`.split("\n");

describe("frontmatter line context", () => {
  it("recognizes the item type and keys", () => {
    expect(itemTypeFromFrontmatter(file)).toBe("assignment");
    expect(presentKeys(file).has("Schedule")).toBe(true);
    expect(presentKeys(file).has("Key")).toBe(false);
  });

  it("describes key/value lines", () => {
    expect(getLineContext(file, 0)).toEqual({
      kind: "value", key: "UnlockAt", valueStart: 11, value: "", needsSpace: false,
    });
    expect(getLineContext(file, 4)).toEqual({
      kind: "value", key: "GroupSet", valueStart: 10, value: "", needsSpace: true,
    });
    expect(getLineContext(file, 3)).toMatchObject({ kind: "value", value: "Labs" });
  });

  it("describes schedule students, dates, and blank spots", () => {
    expect(getLineContext(file, 7)).toEqual({
      kind: "listItem", header: "Schedule", itemStart: 7,
      text: "Mccormick, Bradley", needsDash: false, scheduleDate: "09/18/2026",
    });
    expect(getLineContext(file, 8)).toMatchObject({ kind: "listItem", text: "", needsDash: false });
    expect(getLineContext(file, 9)).toEqual({ kind: "scheduleDateKey", indent: "  ", date: undefined });
    expect(getLineContext(file, 10)).toMatchObject({ kind: "listItem", needsDash: true, itemStart: 5 });
    expect(getLineContext(file, 11)).toEqual({ kind: "scheduleDateKey", indent: "  ", date: "10/09/2026" });
    expect(getLineContext(file, 6)).toEqual({ kind: "scheduleDateKey", indent: "  ", date: "09/18/2026" });
  });

  it("describes list items under a column-0 header and blank key lines", () => {
    expect(getLineContext(file, 15)).toMatchObject({ kind: "listItem", header: "SubmissionTypes", text: "online_text_entry", itemStart: 3 });
    expect(getLineContext(file, 16)).toMatchObject({ kind: "listItem", header: "SubmissionTypes", text: "" });
    expect(getLineContext(file, 13)).toEqual({ kind: "blankKey" });
  });

  it("ignores everything after the ---", () => {
    expect(getLineContext(file, 17)).toBeNull();
    expect(getLineContext(file, 19)).toBeNull();
    expect(getLineContext(file, 20)).toBeNull();
  });

  it("lists the scheduled students with their dates", () => {
    expect(scheduleStudentLines(file)).toEqual([
      { lineIndex: 7, label: "Mccormick, Bradley", date: "09/18/2026", column: 7 },
    ]);
  });

  it("detects quizzes and pages", () => {
    expect(itemTypeFromFrontmatter(["DueDateForOrdering: 1/1/2026", "---"])).toBe("page");
    expect(itemTypeFromFrontmatter(["DueAt: 1/1/2026", "ShuffleAnswers: true", "---"])).toBe("quiz");
    expect(itemTypeFromFrontmatter(["Name: Lecture", "---"])).toBe("lecture");
    expect(itemTypeFromFrontmatter(["no frontmatter"])).toBe("unknown");
  });
});
