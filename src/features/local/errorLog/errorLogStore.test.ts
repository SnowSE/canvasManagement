import { beforeEach, describe, expect, it } from "vitest";
import { errorLog, fileErrorKey, logError, resolveError } from "./errorLogStore";

describe("error log", () => {
  beforeEach(() => errorLog.clear());

  it("counts a repeated keyless error instead of listing it twice", () => {
    logError({ source: "a", message: "boom" });
    logError({ source: "b", message: "boom" });
    expect(errorLog.list()).toHaveLength(1);
    expect(errorLog.list()[0].count).toBe(2);
  });

  it("folds a browser report into the keyed server error with the same message", () => {
    logError({ key: fileErrorKey("/x.md"), source: "Reading x", message: "bad rubric" });
    logError({ source: "Shown as an error message", message: "bad rubric", origin: "browser" });
    const [entry] = errorLog.list();
    expect(errorLog.list()).toHaveLength(1);
    expect(entry.source).toBe("Reading x");
  });

  it("treats re-reading an unchanged broken file as one occurrence", () => {
    const key = fileErrorKey("/x.md");
    logError({ key, source: "Reading x", message: "bad rubric" });
    logError({ key, source: "Reading x", message: "bad rubric" });
    expect(errorLog.list()[0].count).toBe(1);
  });

  it("does not count the failed request on a broken file as another occurrence", () => {
    logError({ key: fileErrorKey("/x.md"), source: "Reading x", message: "bad rubric" });
    logError({ source: "Server request quiz.getQuiz", message: "bad rubric" });
    logError({ source: "Shown as an error message", message: "bad rubric", origin: "browser" });
    expect(errorLog.list()[0].count).toBe(1);
  });

  it("marks a keyed error fixed, and unfixed again if it comes back", () => {
    const key = fileErrorKey("/x.md");
    logError({ key, source: "Reading x", message: "bad rubric" });
    resolveError(key);
    expect(errorLog.list()[0].resolved).toBe(true);
    logError({ key, source: "Reading x", message: "bad rubric" });
    expect(errorLog.list()[0]).toMatchObject({ resolved: false, count: 2 });
  });

  it("drops a stale explanation when the message changes", () => {
    const key = fileErrorKey("/x.md");
    const entry = logError({ key, source: "Reading x", message: "first" });
    entry.explanation = "about first";
    logError({ key, source: "Reading x", message: "second" });
    expect(errorLog.list()[0].explanation).toBeUndefined();
  });
});
