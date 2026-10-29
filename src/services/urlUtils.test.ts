import { describe, it, expect } from "vitest";
import { courseView, getCanvasHomeUrlFor, itemView } from "./urlUtils";

describe("getCanvasHomeUrlFor", () => {
  it("is the course home page in Canvas for a page with AddToHome: true", () => {
    expect(getCanvasHomeUrlFor({ addToHome: true }, 1234)).toBe(
      "https://snow.instructure.com/courses/1234"
    );
  });

  it("is undefined for a page that isn't added to the home page", () => {
    expect(getCanvasHomeUrlFor({ addToHome: false }, 1234)).toBeUndefined();
    expect(getCanvasHomeUrlFor({}, 1234)).toBeUndefined();
  });
});

describe("keeping the view when picking another item or course", () => {
  const item = "/course/CS%201400/modules/01%20-%20Intro/assignment/Lab%201";

  it("keeps an item's compare or history view, else its editor", () => {
    expect(itemView(item + "/compare")).toBe("/compare");
    expect(itemView(item + "/history")).toBe("/history");
    expect(itemView(item)).toBe("");
    expect(itemView("/course/CS%201400/settings")).toBe("");
  });

  it("keeps a course's settings or import page, else its calendar", () => {
    expect(courseView("/course/CS%201400/settings")).toBe("/settings");
    expect(courseView("/course/CS%201400/import")).toBe("/import");
    expect(courseView("/course/CS%201400")).toBe("");
    expect(courseView(item + "/compare")).toBe("");
  });
});
