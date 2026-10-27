import { describe, expect, it } from "vitest";
import { quizMarkdownUtils } from "../../quizzes/models/utils/quizMarkdownUtils";
import { QuestionType } from "../../quizzes/models/localQuizQuestion";
import { quizQuestionMarkdownUtils } from "../../quizzes/models/utils/quizQuestionMarkdownUtils";
import { getAnswersForCanvas } from "@/features/canvas/services/canvasQuizService";

describe("numerical answer questions", () => {
  it("can parse question with numerical answers", () => {
    const name = "Test Quiz";
    const rawMarkdownQuiz = `
ShuffleAnswers: true
OneQuestionAtATime: false
DueAt: 08/21/2023 23:59:00
LockAt: 08/21/2023 23:59:00
AssignmentGroup: Assignments
AllowedAttempts: -1
Description: quiz description
---
What is 2+3?
=   5
`;

    const quiz = quizMarkdownUtils.parseMarkdown(rawMarkdownQuiz, name);
    const question = quiz.questions[0];

    expect(question.text).toBe("What is 2+3?");
    expect(question.questionType).toBe(QuestionType.NUMERICAL);
    expect(question.answers[0].numericAnswer).toBe(5);
  });
  it("can parse question with multiple numerical answers", () => {
    const name = "Test Quiz";
    const rawMarkdownQuiz = `
ShuffleAnswers: true
OneQuestionAtATime: false
DueAt: 08/21/2023 23:59:00
LockAt: 08/21/2023 23:59:00
AssignmentGroup: Assignments
AllowedAttempts: -1
Description: quiz description
---
What is 10/4?
= 2.5
= [2.4, 2.6]
`;

    const quiz = quizMarkdownUtils.parseMarkdown(rawMarkdownQuiz, name);
    const question = quiz.questions[0];

    expect(question.questionType).toBe(QuestionType.NUMERICAL);
    expect(question.answers.length).toBe(2);
    expect(question.answers[0].numericAnswer).toBe(2.5);
    expect(question.answers[1].numericalAnswerType).toBe("range_answer");
    expect(question.answers[1].numericAnswerRangeMin).toBe(2.4);
    expect(question.answers[1].numericAnswerRangeMax).toBe(2.6);
  });

  it("can parse question with range answers", () => {
    const name = "Test Quiz";
    const rawMarkdownQuiz = `
ShuffleAnswers: true
OneQuestionAtATime: false
DueAt: 08/21/2023 23:59:00
LockAt: 08/21/2023 23:59:00
AssignmentGroup: Assignments
AllowedAttempts: -1
Description: quiz description
---
What is the cube root of 2?
= [1.2598, 1.2600]
`;

    const quiz = quizMarkdownUtils.parseMarkdown(rawMarkdownQuiz, name);
    const question = quiz.questions[0];

    expect(question.text).toBe("What is the cube root of 2?");
    expect(question.questionType).toBe(QuestionType.NUMERICAL);
    expect(question.answers[0].numericalAnswerType).toBe("range_answer");
    expect(question.answers[0].numericAnswerRangeMin).toBe(1.2598);
    expect(question.answers[0].numericAnswerRangeMax).toBe(1.26);
  });

  const parseOnly = (questionMarkdown: string) =>
    quizMarkdownUtils.parseMarkdown(
      `ShuffleAnswers: true
OneQuestionAtATime: false
DueAt: 08/21/2023 23:59:00
LockAt: 08/21/2023 23:59:00
AssignmentGroup: Assignments
AllowedAttempts: -1
Description: quiz description
---
${questionMarkdown}`,
      "Test Quiz",
    ).questions[0];

  it("reads a margin of error written +- or ±", () => {
    const question = parseOnly(`What is pi?
= 3.14 +- 0.01
= 3 ± 0.5`);
    expect(question.questionType).toBe(QuestionType.NUMERICAL);
    expect(question.answers.map((a) => [a.numericAnswer, a.numericAnswerMargin])).toEqual([
      [3.14, 0.01],
      [3, 0.5],
    ]);
  });

  it("writes a margin back out as +-", () => {
    const question = parseOnly(`What is pi?
= 3.14 ± 0.01`);
    expect(quizQuestionMarkdownUtils.toMarkdown(question)).toBe(`Points: 1
What is pi?
= 3.14 +- 0.01`);
  });

  it("sends exact answers and margins under the names Canvas reads", () => {
    const question = parseOnly(`What is 10/4?
= 2.5
= 2.5 +- 0.1
= [2.4, 2.6]`);
    expect(getAnswersForCanvas(question, {} as never)).toEqual([
      { numerical_answer_type: "exact_answer", answer_exact: 2.5, answer_error_margin: 0 },
      { numerical_answer_type: "exact_answer", answer_exact: 2.5, answer_error_margin: 0.1 },
      { numerical_answer_type: "range_answer", answer_range_start: 2.4, answer_range_end: 2.6 },
    ]);
  });
});
