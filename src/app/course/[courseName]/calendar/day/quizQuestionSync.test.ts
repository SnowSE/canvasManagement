import { describe, it, expect } from "vitest";
import { checkQuizQuestions } from "./quizQuestionSync";
import { CanvasQuizQuestion } from "@/features/canvas/models/quizzes/canvasQuizQuestionModel";
import {
  DayOfWeek,
  LocalCourseSettings,
} from "@/features/local/course/localCourseSettings";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";

const settings: LocalCourseSettings = {
  name: "test course",
  assignmentGroups: [],
  daysOfWeek: [DayOfWeek.Monday, DayOfWeek.Wednesday],
  startDate: "01/01/2024 00:00:00",
  endDate: "05/01/2024 00:00:00",
  defaultDueTime: { hour: 23, minute: 59 },
  canvasId: 100,
  defaultAssignmentSubmissionTypes: [],
  defaultFileUploadTypes: [],
  holidays: [],
  assets: [],
};

const questionsOf = (markdown: string) =>
  quizMarkdownUtils.parseMarkdown(
    `ShuffleAnswers: true
OneQuestionAtATime: false
DueAt: 08/21/2023 23:59:00
LockAt: 08/21/2023 23:59:00
AssignmentGroup: Assignments
AllowedAttempts: -1
Description:
---
${markdown}`,
    "Test Quiz",
  ).questions;

// Canvas wraps stored HTML in the account theme's stylesheet and script
const themed = (html: string) =>
  `<link rel="stylesheet" href="https://example.com/theme.css">${html}\n<script src="https://example.com/theme.js"></script>`;

const canvasQuestion = (
  partial: Partial<CanvasQuizQuestion>,
): CanvasQuizQuestion => ({
  id: 1,
  quiz_id: 1,
  question_name: "Question",
  question_type: "multiple_choice_question",
  question_text: "",
  points_possible: 1,
  correct_comments: "",
  incorrect_comments: "",
  neutral_comments: "",
  answers: [],
  ...partial,
});

const multipleChoice = `Points: 1
Staged rollout exists to:
+ Right.
*a) Bound the blast radius
b) Save bandwidth`;

const canvasMultipleChoice = canvasQuestion({
  question_text: themed("<p>Staged rollout exists to:</p>"),
  correct_comments: "Right.",
  answers: [
    { id: 1, text: "Bound the blast radius", html: themed("<p>Bound the blast radius</p>"), weight: 100 },
    { id: 2, text: "Save bandwidth", html: themed("<p>Save bandwidth</p>"), weight: 0 },
  ],
});

describe("checkQuizQuestions", () => {
  it("matches a multiple choice question despite the theme wrapper", () => {
    const [field] = checkQuizQuestions(
      questionsOf(multipleChoice),
      [canvasMultipleChoice],
      settings,
    );
    expect(field.same).toBe(true);
    expect(field.label).toBe("Question 1 · multiple choice");
  });

  it("reports a different correct answer", () => {
    const [field] = checkQuizQuestions(
      questionsOf(multipleChoice),
      [
        {
          ...canvasMultipleChoice,
          answers: canvasMultipleChoice.answers!.map((a) => ({
            ...a,
            weight: a.weight ? 0 : 100,
          })),
        },
      ],
      settings,
    );
    expect(field.same).toBe(false);
    expect(field.message).toBe("question 1 answers different");
    expect(field.local).toContain("✓ Bound the blast radius");
    expect(field.canvas).toContain("✓ Save bandwidth");
  });

  it("reports points, text and type together", () => {
    const [field] = checkQuizQuestions(
      questionsOf(`Points: 2
Name one mechanism.
essay`),
      [
        canvasQuestion({
          question_type: "short_answer_question",
          question_text: "<p>Name two mechanisms.</p>",
        }),
      ],
      settings,
    );
    expect(field.message).toBe("question 1 type, points, text different");
    expect(field.local).toContain("type: essay");
    expect(field.canvas).toContain("type: short answer");
    expect(field.local).toContain("points: 2");
  });

  it("reports changed feedback", () => {
    const [field] = checkQuizQuestions(
      questionsOf(multipleChoice),
      [{ ...canvasMultipleChoice, correct_comments: "Yes." }],
      settings,
    );
    expect(field.message).toBe("question 1 feedback different");
  });

  it("reports questions missing from either side", () => {
    const fields = checkQuizQuestions(
      questionsOf(`${multipleChoice}

---

Points: 1
Why?
essay`),
      [canvasMultipleChoice],
      settings,
    );
    expect(fields).toHaveLength(2);
    expect(fields[1].message).toBe("question 2 not in canvas");

    const extra = checkQuizQuestions(
      [],
      [canvasMultipleChoice],
      settings,
    );
    expect(extra[0].message).toBe("question 1 is only in canvas");
  });

  it("compares matching pairs and distractors", () => {
    const local = questionsOf(`Points: 1
Match them.
^ Blue-green - two environments
^ Canary - small percentage
^ - every Friday`);
    const canvas = canvasQuestion({
      question_type: "matching_question",
      question_text: themed("<p>Match them.</p>"),
      answers: [
        { id: 1, text: "Blue-green", left: "Blue-green", right: "two environments", weight: 0 },
        { id: 2, text: "Canary", left: "Canary", right: "small percentage", weight: 0 },
      ],
      matching_answer_incorrect_matches: "every Friday",
    });
    expect(checkQuizQuestions(local, [canvas], settings)[0].same).toBe(true);
    expect(
      checkQuizQuestions(
        local,
        [{ ...canvas, matching_answer_incorrect_matches: "" }],
        settings,
      )[0].message,
    ).toBe("question 1 answers different");
  });

  it("compares fill in multiple blanks answers per blank", () => {
    const local = questionsOf(`Points: 2
You [action] the rollout and flip a [mechanism].
[action] = halt
         = pause
[mechanism] = feature flag`);
    const canvas = canvasQuestion({
      question_type: "fill_in_multiple_blanks_question",
      points_possible: 2,
      question_text: "<p>You [action] the rollout and flip a [mechanism].</p>",
      answers: [
        { id: 1, text: "halt", weight: 100, blank_id: "action" },
        { id: 2, text: "pause", weight: 100, blank_id: "action" },
        { id: 3, text: "feature flag", weight: 100, blank_id: "mechanism" },
      ],
    });
    expect(checkQuizQuestions(local, [canvas], settings)[0].same).toBe(true);
    expect(
      checkQuizQuestions(
        local,
        [{ ...canvas, answers: canvas.answers!.slice(0, 2) }],
        settings,
      )[0].same,
    ).toBe(false);
  });
});
