import { describe, expect, it } from "vitest";
import { itemTitle, lectureTitle, pageTitle } from "./titleUtils";

describe("pageTitle", () => {
  it("is just the app name with nothing specific", () => {
    expect(pageTitle({})).toBe("Canvas Manager");
  });

  it("puts the item first, then the decoded course name", () => {
    expect(
      pageTitle({
        thing: itemTitle("Quiz: ", "W02%20Reading"),
        courseName: "3840%20Telemetry",
      }),
    ).toBe("Quiz: W02 Reading · 3840 Telemetry — Canvas Manager");
  });

  it("can leave off the app name", () => {
    expect(
      pageTitle({
        thing: "History: W03",
        courseName: "Telemetry",
        withAppName: false,
      }),
    ).toBe("History: W03 · Telemetry");
  });
});

describe("lectureTitle", () => {
  it("shows the weekday and short date", () => {
    expect(lectureTitle("10%2F27%2F2026")).toBe("Lecture Tue Oct 27");
  });

  it("falls back to the raw value when it is not a date", () => {
    expect(lectureTitle("someday")).toBe("Lecture someday");
  });
});
