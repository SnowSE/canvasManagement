import { beforeEach, describe, expect, it } from "vitest";
import { checkedQuizzesIn } from "./checkedQuizzes";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";

const kept = new Map<string, string>();
const store = {
  getItem: (k: string) => kept.get(k) ?? null,
  setItem: (k: string, v: string) => void kept.set(k, v),
  removeItem: (k: string) => void kept.delete(k),
  key: (i: number) => [...kept.keys()][i] ?? null,
  get length() {
    return kept.size;
  },
};
const checked = checkedQuizzesIn(() => store);
const questionsOf = (body: string) =>
  quizMarkdownUtils.parseMarkdown(`ShuffleAnswers: true\nOneQuestionAtATime: false\nDueAt: 08/21/2023 23:59:00\nLockAt: 08/21/2023 23:59:00\nAssignmentGroup: Assignments\nAllowedAttempts: -1\nDescription:\n---\n${body}`, "Quiz").questions;
const questions = questionsOf("Points: 1\nWhat is 2 + 4?\n*a) 6\nb) 8");

// What this browser remembers of quizzes whose questions matched Canvas, so a
// quiz outside the calendar's four weeks isn't fetched just to be called in
// sync. Canvas is taken as unchanged unless the user says otherwise (Reload
// Canvas Data), so only the file's side is remembered.
describe("a quiz whose questions matched Canvas when last checked", () => {
  beforeEach(() => kept.clear());
  it("still matches while its file's questions haven't changed", () => {
    checked.remember(42, "Quiz", questions);
    expect(checked.stillMatches(42, "Quiz", questionsOf("Points: 1\nWhat is 2 + 4?\n*a) 6\nb) 8"))).toBe(true);
  });
  it("no longer does once the file's questions changed, by the app or anything else", () => {
    checked.remember(42, "Quiz", questions);
    expect(checked.stillMatches(42, "Quiz", questionsOf("Points: 1\nWhat is 3 + 3?\n*a) 6\nb) 8"))).toBe(false);
  });
  it("is nothing for a quiz never checked, or another course's", () => {
    checked.remember(42, "Quiz", questions);
    expect(checked.stillMatches(42, "Other quiz", questions)).toBe(false);
    expect(checked.stillMatches(43, "Quiz", questions)).toBe(false);
  });
  it("is forgotten for the whole course when the user reloads Canvas's data, and only that course's", () => {
    checked.remember(42, "Quiz", questions);
    checked.remember(43, "Quiz", questions);
    checked.forgetCourse(42);
    expect(checked.stillMatches(42, "Quiz", questions)).toBe(false);
    expect(checked.stillMatches(43, "Quiz", questions)).toBe(true);
  });
});
