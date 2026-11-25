import { describe, expect, it } from "vitest";
import { placeInCourseFiles } from "./canvasCourseFileService";

describe("a Canvas file's place in the course's files", () => {
  it("is its folders' names below the course's own folder, then its name: as a course file's place is on disk", () => {
    expect(placeInCourseFiles("course files/Week 1/files", "koans.html")).toBe("Week 1/files/koans.html");
    expect(placeInCourseFiles("course files", "koans.html")).toBe("koans.html");
  });
});
