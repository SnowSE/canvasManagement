import { describe, it, expect } from "vitest";
import { courseInPath } from "./courseInPath";

describe("courseInPath", () => {
  it("is the course a page belongs to", () => {
    expect(courseInPath("/course/Algorithms")).toBe("Algorithms");
    expect(courseInPath("/course/Mobile%20('26%20Fall)/modules/01/page/Intro")).toBe("Mobile ('26 Fall)");
  });

  it("is undefined outside a course, like the course list", () => {
    expect(courseInPath("/")).toBeUndefined();
    expect(courseInPath("/errors")).toBeUndefined();
  });
});
