import { describe, it, expect } from "vitest";
import { differenceText } from "./differenceText";

const field = (local: string, canvas: string) => ({
  key: "group",
  label: "Assignment group",
  section: "grading" as const,
  local,
  canvas,
  same: false,
  message: "assignment group is different",
});

describe("differenceText", () => {
  it("shows both values when they're short", () => {
    expect(differenceText(field("Labs", "Homework"))).toBe("Assignment group: local Labs vs Canvas Homework");
  });

  it("keeps the sentence for a description, whose text is on the compare page", () => {
    const description = {
      ...field("rendered from markdown", "current description"),
      section: "description" as const,
      message: "Canvas description is different",
    };
    expect(differenceText(description)).toBe("Canvas description is different");
  });

  it("keeps the sentence for values too long to read in a line", () => {
    expect(differenceText(field("x".repeat(200), "y".repeat(200)))).toBe("assignment group is different");
  });
});
