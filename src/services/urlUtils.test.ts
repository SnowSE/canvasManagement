import { describe, it, expect } from "vitest";
import { getCanvasHomeUrlFor } from "./urlUtils";

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
