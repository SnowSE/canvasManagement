import { describe, it, expect } from "vitest";
import { snippetAt, sourceOffsetOf } from "./previewJump";

describe("snippetAt", () => {
  it("is the clicked text node's text when it is short", () => {
    expect(snippetAt("Lexical scope, closures", 5)).toEqual({
      text: "Lexical scope, closures",
      start: 0,
    });
  });

  it("is a window of whole words around the click in a long text", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve thirteen";
    expect(snippetAt(text, text.indexOf("seven"))).toEqual({
      text: "three four five six seven eight nine ten",
      start: text.indexOf("three"),
    });
  });
});

describe("sourceOffsetOf", () => {
  const source = "DueDateForOrdering: 1/1\n---\n# Intro\n\nsee Day 1\n\n## Later\n\nsee Day 1\n";

  it("finds the text in the file", () => {
    expect(sourceOffsetOf(source, "Later", 0.5)).toBe(source.indexOf("Later"));
  });

  it("picks the match nearest the click's place in the preview", () => {
    expect(sourceOffsetOf(source, "see Day 1", 0.1)).toBe(source.indexOf("see Day 1"));
    expect(sourceOffsetOf(source, "see Day 1", 0.9)).toBe(source.lastIndexOf("see Day 1"));
  });

  it("is undefined when the text isn't in the file", () => {
    expect(sourceOffsetOf(source, "rendered only", 0.5)).toBeUndefined();
  });
});
