import { describe, it, expect } from "vitest";
import { currentItemFromPath, defaultLectureDay } from "./currentItem";
import { DayOfWeek } from "@/features/local/course/localCourseSettings";

// Mondays and Wednesdays from Wed Aug 26 to Wed Sep 9 2026, Labor Day off
const settings = {
  startDate: "2026-08-26T06:00:00Z",
  endDate: "2026-09-10T05:59:59Z",
  daysOfWeek: [DayOfWeek.Monday, DayOfWeek.Wednesday],
  holidays: [{ name: "laborDay", days: ["09/07/2026"] }],
};
const day = (month: number, date: number) => new Date(2026, month - 1, date, 10);

describe("defaultLectureDay", () => {
  it("is today when it's a class day", () => {
    expect(defaultLectureDay(settings, day(8, 26))).toBe("08/26/2026");
  });
  it("else the next class day, skipping holidays", () => {
    expect(defaultLectureDay(settings, day(8, 27))).toBe("08/31/2026");
    expect(defaultLectureDay(settings, day(9, 5))).toBe("09/09/2026");
    expect(defaultLectureDay(settings, day(7, 1))).toBe("08/26/2026");
  });
  it("else the term's last class day", () => {
    expect(defaultLectureDay(settings, day(10, 1))).toBe("09/09/2026");
  });
  it("is nothing for a course without class days", () => {
    expect(defaultLectureDay({ ...settings, daysOfWeek: [] }, day(8, 26))).toBeUndefined();
  });
});

describe("currentItemFromPath", () => {
  it("names the lecture day as its file does, whatever the url said", () => {
    expect(currentItemFromPath("/course/c/lecture/9%2F9%2F2026")).toEqual({ kind: "lecture", lectureDay: "09/09/2026" });
    expect(currentItemFromPath("/course/c/lecture/not-a-date")).toBeUndefined();
  });
  it("reads an item's module, type and name", () => {
    expect(currentItemFromPath("/course/c/modules/01%20Intro/quiz/Quiz%201")).toEqual({ kind: "item", moduleName: "01 Intro", type: "Quiz", name: "Quiz 1" });
    expect(currentItemFromPath("/course/c")).toBeUndefined();
  });
});
