import { describe, it, expect } from "vitest";
import {
  checkQuizQuestions,
  describeQuestionPlan,
  planQuestionUpdates,
  pointTotalChangeError,
} from "./quizQuestionSync";
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

  it("shows a matching question's answers, not just its text", () => {
    const [field] = checkQuizQuestions(
      questionsOf(multipleChoice),
      [canvasMultipleChoice],
      settings,
    );
    expect(field.local.split("\n")).toEqual([
      "type: multiple choice · points: 1",
      "Staged rollout exists to:",
      "✓ Bound the blast radius",
      "Save bandwidth",
      "+ Right.",
    ]);
    expect(field.canvas).toBe(field.local);
  });

  it("shows the whole question when one part differs, marking that part", () => {
    const [field] = checkQuizQuestions(
      questionsOf(multipleChoice),
      [{ ...canvasMultipleChoice, correct_comments: "Yes." }],
      settings,
    );
    expect(field.local).toContain("Staged rollout exists to:");
    expect(field.local).toContain("✓ Bound the blast radius");
    expect(field.local).toContain("≠ + Right.");
    expect(field.canvas).toContain("≠ + Yes.");
    expect(field.canvas).not.toContain("≠ Staged");
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

  it("compares short answers as text, since Canvas keeps no html for them", () => {
    const [field] = checkQuizQuestions(
      questionsOf(`Points: 1
Give the root operator, then the postfix expression.
*a) +
*b) 5782-*+63*+
short_answer=`),
      [
        canvasQuestion({
          question_type: "short_answer_question",
          question_text: "<p>Give the root operator, then the postfix expression.</p>",
          answers: [
            { id: 1, text: "+", html: "", weight: 100 },
            { id: 2, text: "5782-*+63*+", html: "", weight: 100 },
          ],
        }),
      ],
      settings,
    );
    expect(field.message).toBe("");
    expect(field.same).toBe(true);
  });

  it("can ignore answer order, since each student attempt shuffles its answers", () => {
    const shuffled = {
      ...canvasMultipleChoice,
      answers: [...canvasMultipleChoice.answers!].reverse(),
    };
    const [inOrder] = checkQuizQuestions(
      questionsOf(multipleChoice),
      [shuffled],
      settings,
    );
    expect(inOrder.same).toBe(false);

    const [ignoringOrder] = checkQuizQuestions(
      questionsOf(multipleChoice),
      [shuffled],
      settings,
      { ignoreAnswerOrder: true },
    );
    expect(ignoringOrder.same).toBe(true);
    // shown lined up with the file's order
    expect(ignoringOrder.canvas).toBe(ignoringOrder.local);
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
    expect(extra[0].message).toBe("canvas question 1 is not in the file");
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

describe("checkQuizQuestions - lining questions up", () => {
  const essays = [
    "Explain why a heartbeat timeout cannot prove a peer crashed.",
    "Describe what a vector clock records and why.",
    "Name the telemetry you would add to a geolocation feature.",
    "Compute the error budget for a 99.5 percent SLO over thirty days.",
    "Contrast leader election with consensus on a single value.",
  ];
  const fileOf = (texts: string[]) =>
    questionsOf(
      texts.map((t) => `Points: 1\n${t}\nessay`).join("\n\n---\n\n"),
    );
  const canvasOf = (texts: string[]) =>
    texts.map((t, i) =>
      canvasQuestion({
        id: i + 1,
        question_type: "essay_question",
        question_text: themed(`<p>${t}</p>`),
      }),
    );

  it("shows a question deleted from the file as one row and keeps the rest lined up", () => {
    const fields = checkQuizQuestions(
      fileOf([essays[0], essays[1], essays[3], essays[4]]),
      canvasOf(essays),
      settings,
    );
    expect(fields.map((f) => f.same)).toEqual([true, true, false, true, true]);
    expect(fields[2].label).toBe("Canvas question 3");
    expect(fields[2].message).toBe("canvas question 3 is not in the file");
    expect(fields[2].canvas).toContain("geolocation");
    expect(fields[3].label).toBe("Question 3 · essay");
  });

  it("shows a question added to the file as one row", () => {
    const fields = checkQuizQuestions(
      fileOf(essays),
      canvasOf([essays[0], essays[2], essays[3], essays[4]]),
      settings,
    );
    expect(fields.map((f) => f.same)).toEqual([true, false, true, true, true]);
    expect(fields[1].message).toBe("question 2 not in canvas");
  });

  it("still compares an edited question with its old version", () => {
    const edited = [...essays];
    edited[2] = "Name the telemetry you would add to a geolocation screen.";
    const fields = checkQuizQuestions(fileOf(edited), canvasOf(essays), settings);
    expect(fields).toHaveLength(5);
    expect(fields[2].message).toBe("question 3 text different");
  });

  it("pairs a question rewritten in place with the one it replaced", () => {
    const rewritten = [...essays];
    rewritten[2] = "What does idempotency buy a retrying client?";
    const fields = checkQuizQuestions(fileOf(rewritten), canvasOf(essays), settings);
    expect(fields).toHaveLength(5);
    expect(fields[2].message).toBe("question 3 text different");
  });

  it("reports a moved question as moved, not as deleted and added", () => {
    const fields = checkQuizQuestions(
      fileOf([essays[4], essays[0], essays[1], essays[2], essays[3]]),
      canvasOf(essays),
      settings,
    );
    expect(fields).toHaveLength(5);
    expect(fields[0].message).toBe("question 1 position different");
    expect(fields[0].canvas).toContain("position: 5");
    expect(fields.slice(1).every((f) => f.same)).toBe(true);
  });
  describe("planQuestionUpdates", () => {
    it("leaves alone a quiz whose questions match the file", () => {
      expect(
        planQuestionUpdates(questionsOf(multipleChoice), [canvasMultipleChoice], settings),
      ).toEqual([{ local: 0, canvas: 0, same: true, moved: false }]);
    });

    it("pairs an edited question with its old version, adds a new one and deletes a removed one", () => {
      const file = [essays[0], `${essays[1]} Give an example.`, essays[3], "What does idempotency buy a retrying client? Explain."];
      const canvas = [essays[0], essays[1], essays[2], essays[3]];
      expect(planQuestionUpdates(fileOf(file), canvasOf(canvas), settings)).toEqual([
        { local: 0, canvas: 0, same: true, moved: false },
        { local: 1, canvas: 1, same: false, moved: false },
        { local: undefined, canvas: 2, same: false, moved: false },
        { local: 2, canvas: 3, same: true, moved: false },
        { local: 3, canvas: undefined, same: false, moved: false },
      ]);
    });

    it("replaces every question of a quiz with groups", () => {
      const plan = planQuestionUpdates(
        fileOf([essays[0], essays[1]]),
        canvasOf([essays[0], essays[1]]).map((q) => canvasQuestion({ ...q, quiz_group_id: 5 })),
        settings,
      );
      expect(describeQuestionPlan(plan)).toBe("all 2 questions replaced");
    });

    it("replaces every question of a quiz that uses a question bank, which is always in a group", () => {
      const quiz = quizMarkdownUtils.parseMarkdown(
        `ShuffleAnswers: true\nOneQuestionAtATime: false\nDueAt: 08/21/2023 23:59:00\nLockAt: 08/21/2023 23:59:00\nAssignmentGroup: Assignments\nAllowedAttempts: -1\nDescription:\n---\nGroup: Ports\nPick: 1\nPoints: 2\nBank: ../banks/ports.md\n---\nEndGroup\n---\nPoints: 5\n${essays[0]}\nessay`,
        "Test Quiz",
        undefined,
        { "../banks/ports.md": "What port does HTTP use?\n*a) 80\nb) 443\n---\nWhat port does HTTPS use?\na) 80\n*b) 443" },
      );
      const plan = planQuestionUpdates(quiz.questions, canvasOf([essays[0]]), settings);
      expect(describeQuestionPlan(plan)).toBe(
        "all 3 questions replaced",
      );
    });

    it("only moves a question that moved", () => {
      const plan = planQuestionUpdates(
        fileOf([essays[4], essays[0], essays[1], essays[2], essays[3]]),
        canvasOf(essays),
        settings,
      );
      expect(plan[0]).toEqual({ local: 0, canvas: 4, same: true, moved: true });
      expect(plan.every((r) => r.same)).toBe(true);
    });
  });
});

describe("pointTotalChangeError", () => {
  it("allows an update that keeps the total students were scored out of", () => {
    expect(
      pointTotalChangeError(questionsOf(multipleChoice), [canvasMultipleChoice]),
    ).toBeUndefined();
  });

  it("refuses one that changes it, giving both totals", () => {
    expect(
      pointTotalChangeError(questionsOf(multipleChoice), [
        { ...canvasMultipleChoice, points_possible: 3 },
      ]),
    ).toBe(
      "Students who started were scored out of 3 points, and the file's questions total 1. Changing the total needs a regrade in Canvas, so the quiz was not updated.",
    );
  });
});

describe("numerical questions", () => {
  const local = questionsOf(`Points: 1
What is 10/4?
= 2.5 +- 0.1
= [2.4, 2.6]`);
  const canvas = (exact: number, margin: number) =>
    canvasQuestion({
      question_type: "numerical_question",
      question_text: "<p>What is 10/4?</p>",
      answers: [
        { id: 1, text: "", weight: 100, numerical_answer_type: "exact_answer", exact, margin },
        { id: 2, text: "", weight: 100, numerical_answer_type: "range_answer", start: 2.4, end: 2.6 },
      ],
    });

  it("match when Canvas has the same values and margin", () => {
    expect(checkQuizQuestions(local, [canvas(2.5, 0.1)], settings)[0].same).toBe(true);
  });

  it("differ when Canvas saved the exact answer as 0", () => {
    expect(checkQuizQuestions(local, [canvas(0, 0)], settings)[0].same).toBe(false);
  });
});

describe("question groups", () => {
  const local = questionsOf(`Group: Ports
Pick: 1
Points: 2
---
What port does HTTP use?
*a) 80
b) 443
---
What port does SSH use?
*a) 22
b) 21
---
EndGroup`);
  const canvasPortQuestion = (text: string, right: string, wrong: string, group?: { name: string; pick_count: number }) =>
    canvasQuestion({
      question_text: `<p>${text}</p>`,
      points_possible: 2,
      answers: [
        { id: 1, text: right, html: `<p>${right}</p>`, weight: 100 },
        { id: 2, text: wrong, html: `<p>${wrong}</p>`, weight: 0 },
      ],
      ...(group && { quiz_group_id: 5, quiz_group: { id: 5, question_points: 2, ...group } }),
    });
  const ports = { name: "Ports", pick_count: 1 };

  it("match when Canvas has the same group", () => {
    const canvas = [
      canvasPortQuestion("What port does HTTP use?", "80", "443", ports),
      canvasPortQuestion("What port does SSH use?", "22", "21", ports),
    ];
    expect(checkQuizQuestions(local, canvas, settings).every((f) => f.same)).toBe(true);
  });

  it("differ when Canvas has the questions outside the group, or picks a different number", () => {
    const outside = checkQuizQuestions(local, [
      canvasPortQuestion("What port does HTTP use?", "80", "443"),
      canvasPortQuestion("What port does SSH use?", "22", "21"),
    ], settings);
    expect(outside[0].same).toBe(false);
    expect(outside[0].message).toContain("group");
    expect(outside[0].local).toContain("group: Ports, pick 1");

    const pickTwo = checkQuizQuestions(local, [
      canvasPortQuestion("What port does HTTP use?", "80", "443", { name: "Ports", pick_count: 2 }),
      canvasPortQuestion("What port does SSH use?", "22", "21", { name: "Ports", pick_count: 2 }),
    ], settings);
    expect(pickTwo.every((f) => f.same)).toBe(false);
  });

  it("don't count a question a student's attempt wasn't picked as missing", () => {
    const attempt = [canvasPortQuestion("What port does SSH use?", "22", "21")];
    const fields = checkQuizQuestions(local, attempt, settings, { ignoreAnswerOrder: true, isAttempt: true });
    expect(fields.every((f) => f.same)).toBe(true);
  });

  it("score a group once per question picked when checking the point total", () => {
    const attempt = [canvasQuestion({ points_possible: 2 })];
    expect(pointTotalChangeError(local, attempt)).toBeUndefined();
  });
});

describe("describeQuestionPlan", () => {
  const row = (local?: number, canvas?: number, same = false, moved = false) => ({ local, canvas, same, moved });

  it("names each question it touches and counts the rest", () => {
    expect(
      describeQuestionPlan([
        row(0, 0, true),
        row(1, 1),
        row(2, 2),
        row(undefined, 3),
        row(3, 4, true, true),
        row(4),
      ]),
    ).toBe("questions 2 and 3 replaced, question 5 added, Canvas question 4 removed, question 4 moved; 1 left alone");
  });

  it("is empty when nothing needs doing", () => {
    expect(describeQuestionPlan([row(0, 0, true), row(1, 1, true)])).toBe("");
  });
});
