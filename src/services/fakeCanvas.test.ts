import { describe, expect, it } from "vitest";
import { towardFakeCanvas } from "./fakeCanvas";

// The walkthrough points the server's Canvas requests at an in-memory fake
// Canvas (CANVAS_FAKE_URL); nothing else may be redirected, and nowhere but
// this machine, since the Canvas token goes with each request.
describe("a Canvas request, with a fake Canvas set", () => {
  const fake = "http://127.0.0.1:3999";
  it("goes to the fake, same path and query", () => {
    expect(towardFakeCanvas("https://snow.instructure.com/api/v1/courses/1/pages?include[]=body", fake)).toBe("http://127.0.0.1:3999/api/v1/courses/1/pages?include[]=body");
    expect(towardFakeCanvas("https://snow.instructure.com/api/quiz/v1/courses/1/quizzes", fake)).toBe("http://127.0.0.1:3999/api/quiz/v1/courses/1/quizzes");
  });
  it("is left as it is with no fake set", () => {
    expect(towardFakeCanvas("https://snow.instructure.com/api/v1/courses/1", undefined)).toBe("https://snow.instructure.com/api/v1/courses/1");
  });
  it("leaves any other address as it is", () => {
    expect(towardFakeCanvas("https://example.com/api/v1/courses/1", fake)).toBe("https://example.com/api/v1/courses/1");
  });
  it("is refused for a fake anywhere but this machine", () => {
    expect(() => towardFakeCanvas("https://snow.instructure.com/api/v1/courses/1", "https://elsewhere.example.com")).toThrow(/only on this machine/);
  });
});
