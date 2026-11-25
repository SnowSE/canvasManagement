import { describe, it, expect } from "vitest";
import { daysUntil, movedToDay, shiftDays } from "./shiftDays";

describe("shiftDays", () => {
  it("moves a date by whole days, keeping its time of day", () => {
    expect(shiftDays("09/04/2026 23:59:00", 3)).toBe("09/07/2026 23:59:00");
    expect(shiftDays("09/04/2026 08:30:00", -4)).toBe("08/31/2026 08:30:00");
  });

  it("keeps the time across a daylight-saving change", () => {
    expect(shiftDays("10/30/2026 23:59:00", 3)).toBe("11/02/2026 23:59:00");
  });

  it("leaves a missing date missing", () => {
    expect(shiftDays(undefined, 3)).toBeUndefined();
    expect(shiftDays("", 3)).toBe("");
  });
});

describe("daysUntil", () => {
  it("counts the days from a date's day to another day, ignoring times", () => {
    expect(daysUntil("09/04/2026 23:59:00", "09/07/2026")).toBe(3);
    expect(daysUntil("09/04/2026 00:01:00", "09/01/2026")).toBe(-3);
  });
});

describe("movedToDay", () => {
  it("moves every date an item has by the days from its due day, and nothing else", () => {
    const quiz = { name: "Quiz 1", dueAt: "09/04/2026 23:59:00", lockAt: "09/06/2026 08:00:00", unlockAt: undefined, text: "09/04/2026" };
    expect(movedToDay(quiz, "09/07/2026")).toEqual({ ...quiz, dueAt: "09/07/2026 23:59:00", lockAt: "09/09/2026 08:00:00" });
  });
  it("gives an item no dates it didn't have", () => {
    expect(movedToDay({ dueAt: "09/04/2026 23:59:00" }, "09/05/2026")).toEqual({ dueAt: "09/05/2026 23:59:00" });
  });
});
