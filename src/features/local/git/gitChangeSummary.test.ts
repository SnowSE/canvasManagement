import { describe, expect, it } from "vitest";
import { describePath, parsePorcelain, suggestCommitMessage } from "./gitChangeSummary";

describe("git change summary", () => {
  it("parses porcelain output, skipping the old name of a rename", () => {
    const output =
      " M Mods/01/assignments/A.md\0?? Mods/01/quizzes/Q.md\0R  Mods/01/pages/New.md\0Mods/01/pages/Old.md\0 D Mods/settings.yml\0";
    expect(parsePorcelain(output)).toEqual([
      { path: "Mods/01/assignments/A.md", kind: "edited" },
      { path: "Mods/01/quizzes/Q.md", kind: "added" },
      { path: "Mods/01/pages/New.md", kind: "renamed" },
      { path: "Mods/settings.yml", kind: "deleted" },
    ]);
  });

  it("names course items in words", () => {
    expect(describePath("01 Chaos KV/assignments/W01 Lab.md")).toBe("assignment W01 Lab");
    expect(describePath("Other/quizzes/W02 Quiz.md")).toBe("quiz W02 Quiz");
    expect(describePath("00 - lectures/week-03/3-Wednesday.md")).toBe("lecture week-03 3-Wednesday");
    expect(describePath("settings.yml")).toBe("course settings");
  });

  it("lists a few changes in the subject and summarizes many", () => {
    expect(
      suggestCommitMessage("Distributed", [
        { path: "01/assignments/A.md", kind: "edited" },
        { path: "01/quizzes/Q.md", kind: "added" },
      ]),
    ).toBe(
      "Distributed: edit assignment A; add quiz Q\n\n- edit assignment A\n- add quiz Q",
    );
    const many = ["A", "B", "C", "D"].map((n) => ({
      path: `01/pages/${n}.md`,
      kind: "edited" as const,
    }));
    expect(suggestCommitMessage("Distributed", many).split("\n")[0]).toBe(
      "Distributed: edit 4 files",
    );
  });
});
