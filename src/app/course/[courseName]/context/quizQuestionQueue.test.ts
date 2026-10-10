import { describe, it, expect } from "vitest";
import { quizzesToCheck } from "./quizQuestionQueue";

// Friday, October 9, 2026; its week starts Sunday, October 4
const today = new Date(2026, 9, 9, 15, 0);

describe("quizzesToCheck", () => {
  it("takes this week and the next three weeks, earliest due first", () => {
    const names = quizzesToCheck(
      [
        { name: "W10 later", dueAt: "10/26/2026 09:29:00" },
        { name: "W08 Monday", dueAt: "10/12/2026 14:29:00" },
        { name: "W07 earlier this week", dueAt: "10/05/2026 14:29:00" },
        { name: "W09 next", dueAt: "10/21/2026 09:29:00" },
      ],
      today,
    );
    expect(names).toEqual([
      "W07 earlier this week",
      "W08 Monday",
      "W09 next",
      "W10 later",
    ]);
  });

  it("leaves out quizzes before this week and four or more weeks out", () => {
    const names = quizzesToCheck(
      [
        { name: "last week", dueAt: "10/03/2026 23:59:00" },
        { name: "first day", dueAt: "10/04/2026 00:00:00" },
        { name: "last day", dueAt: "10/31/2026 23:59:00" },
        { name: "too far", dueAt: "11/01/2026 00:00:00" },
      ],
      today,
    );
    expect(names).toEqual(["first day", "last day"]);
  });

  it("lists a quiz once and skips unreadable due dates", () => {
    expect(
      quizzesToCheck(
        [
          { name: "Quiz", dueAt: "10/12/2026 09:29:00" },
          { name: "Quiz", dueAt: "10/12/2026 09:29:00" },
          { name: "Broken", dueAt: "someday" },
        ],
        today,
      ),
    ).toEqual(["Quiz"]);
  });
});
