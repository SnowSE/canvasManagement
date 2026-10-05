import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { QuestionType } from "@/features/local/quizzes/models/localQuizQuestion";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";
import { quizQuestionMarkdownUtils } from "@/features/local/quizzes/models/utils/quizQuestionMarkdownUtils";
import { describe, it, expect } from "vitest";

// A multiple dropdowns question is written as several matching-style groups
// separated by blank lines. Each prompt becomes one dropdown whose options are
// every answer in its own group (its correct answer, the other prompts'
// answers, and the group's distractors) -- never answers from another group.

const quizWith = (questionMarkdown: string) => `
ShuffleAnswers: true
OneQuestionAtATime: false
DueAt: 08/21/2023 23:59:00
LockAt: 08/21/2023 23:59:00
AssignmentGroup: Assignments
AllowedAttempts: -1
Description:
---
${questionMarkdown}
`;

const parseOnlyQuestion = (questionMarkdown: string) =>
  quizMarkdownUtils.parseMarkdown(quizWith(questionMarkdown), "Test Quiz")
    .questions[0];

const planningQuestion = `Points: 3
Plan the nested function.

^ Name - min_cost_from
^ - paint_next
^ - total_so_far

^ Parameters - (i, prev_color)
^ - (i, cost_so_far)

^ Combine - minimum
^ - sum
^ - maximum`;

describe("MultipleDropdownsTests", () => {
  it("parses blank-line-separated matching groups as multiple dropdowns", () => {
    const question = parseOnlyQuestion(planningQuestion);

    expect(question.questionType).toBe(QuestionType.MULTIPLE_DROPDOWNS);
    expect(question.points).toBe(3);
    expect(question.text).toBe("Plan the nested function.\n");
    expect(question.matchDistractors).toEqual([]);
    expect(question.answers).toEqual([
      { correct: true, text: "Name", matchedText: "min_cost_from", dropdownGroup: 0 },
      { correct: false, text: "", matchedText: "paint_next", dropdownGroup: 0 },
      { correct: false, text: "", matchedText: "total_so_far", dropdownGroup: 0 },
      { correct: true, text: "Parameters", matchedText: "(i, prev_color)", dropdownGroup: 1 },
      { correct: false, text: "", matchedText: "(i, cost_so_far)", dropdownGroup: 1 },
      { correct: true, text: "Combine", matchedText: "minimum", dropdownGroup: 2 },
      { correct: false, text: "", matchedText: "sum", dropdownGroup: 2 },
      { correct: false, text: "", matchedText: "maximum", dropdownGroup: 2 },
    ]);
  });

  it("keeps a group with several prompts together, so they share options", () => {
    const question = parseOnlyQuestion(`Pick the combining step for each.

^ Counting problems - sum
^ Optimization problems - minimum
^ - product

^ Name - ways_to_decode_from
^ - decode`);

    expect(question.questionType).toBe(QuestionType.MULTIPLE_DROPDOWNS);
    expect(question.answers.map((a) => [a.text, a.matchedText, a.dropdownGroup])).toEqual([
      ["Counting problems", "sum", 0],
      ["Optimization problems", "minimum", 0],
      ["", "product", 0],
      ["Name", "ways_to_decode_from", 1],
      ["", "decode", 1],
    ]);
  });

  it("treats several blank lines, or whitespace-only lines, as one separator", () => {
    const question = parseOnlyQuestion(`Question

^ Name - min_cost_from
^ - paint_next



^ Combine - minimum
^ - sum`);

    expect(question.questionType).toBe(QuestionType.MULTIPLE_DROPDOWNS);
    expect(question.answers.map((a) => a.dropdownGroup)).toEqual([0, 0, 1, 1]);
    expect(question.answers.map((a) => a.matchedText)).toEqual([
      "min_cost_from",
      "paint_next",
      "minimum",
      "sum",
    ]);
  });

  it("allows a group with no distractors", () => {
    const question = parseOnlyQuestion(`Question

^ Name - min_cost_from

^ Combine - minimum
^ - sum`);

    expect(question.questionType).toBe(QuestionType.MULTIPLE_DROPDOWNS);
    expect(question.answers.map((a) => [a.text, a.dropdownGroup])).toEqual([
      ["Name", 0],
      ["Combine", 1],
      ["", 1],
    ]);
  });

  it("keeps unicode math and symbols in the options exactly as written", () => {
    const question = parseOnlyQuestion(`Question

^ Options - each color c ≠ prev_color, worth paint_cost[i][c] + min_cost_from(i + 1, c)
^ - each floor x from 1 to floors_left, worth 1 + max(f(e − 1, x − 1), f(e, m − x))

^ Combine - minimum`);

    expect(question.answers[0].matchedText).toBe(
      "each color c ≠ prev_color, worth paint_cost[i][c] + min_cost_from(i + 1, c)"
    );
    expect(question.answers[1].matchedText).toBe(
      "each floor x from 1 to floors_left, worth 1 + max(f(e − 1, x − 1), f(e, m − x))"
    );
  });

  it("throws a clear error when a group has only distractors", () => {
    expect(() =>
      parseOnlyQuestion(`Question

^ Name - min_cost_from

^ - sum
^ - maximum`)
    ).toThrow(/question 1: dropdown group 2 has no prompt/);
  });

  it("throws a clear error when a prompt has no correct answer", () => {
    expect(() =>
      parseOnlyQuestion(`Question

^ Name - min_cost_from

^ Combine -
^ - sum`)
    ).toThrow(/question 1: dropdown prompt "Combine" has no correct answer/);
  });

  it("writes markdown that parses back to the same question", () => {
    const question = parseOnlyQuestion(planningQuestion);

    const markdown = quizQuestionMarkdownUtils.toMarkdown(question);

    expect(markdown).toContain(`^ Name - min_cost_from
^ - paint_next
^ - total_so_far

^ Parameters - (i, prev_color)
^ - (i, cost_so_far)

^ Combine - minimum
^ - sum
^ - maximum`);
    expect(quizQuestionMarkdownUtils.parseMarkdown(markdown, 0)).toEqual(question);
  });

  it("round-trips a whole quiz deterministically", () => {
    const name = "Test Quiz";
    const quiz: LocalQuiz = {
      name,
      description: "quiz description",
      lockAt: "08/21/2023 23:59:00",
      dueAt: "08/21/2023 23:59:00",
      shuffleAnswers: true,
      oneQuestionAtATime: true,
      password: undefined,
      localAssignmentGroupName: "Assignments",
      questions: [
        {
          text: "test dropdowns",
          questionType: QuestionType.MULTIPLE_DROPDOWNS,
          points: 2,
          matchDistractors: [],
          answers: [
            { correct: true, text: "Name", matchedText: "min_cost_from", dropdownGroup: 0 },
            { correct: false, text: "", matchedText: "paint_next", dropdownGroup: 0 },
            { correct: true, text: "Combine", matchedText: "minimum", dropdownGroup: 1 },
          ],
        },
      ],
      allowedAttempts: -1,
      showCorrectAnswers: true,
    };

    const quizMarkdown = quizMarkdownUtils.toMarkdown(quiz);
    const parsedQuiz = quizMarkdownUtils.parseMarkdown(quizMarkdown, name);

    expect(parsedQuiz).toEqual(quiz);
  });

  it("parses the question after a dropdowns question normally", () => {
    const quiz = quizMarkdownUtils.parseMarkdown(
      quizWith(`${planningQuestion}
---
Points: 1
Which is smaller?
*a) 1
b) 2`),
      "Test Quiz"
    );

    expect(quiz.questions.map((q) => q.questionType)).toEqual([
      QuestionType.MULTIPLE_DROPDOWNS,
      QuestionType.MULTIPLE_CHOICE,
    ]);
    expect(quiz.questions[1].answers.map((a) => a.text)).toEqual(["1", "2"]);
  });
});

describe("MatchingIsUnchangedByMultipleDropdowns", () => {
  it("a matching question with no blank lines between its lines stays matching", () => {
    const question = parseOnlyQuestion(`Match the following terms & definitions

^ statement - a single command to be executed
^ identifier - name of a variable
^ - reserved word
^ - other distractor`);

    expect(question.questionType).toBe(QuestionType.MATCHING);
    expect(question.answers).toEqual([
      { correct: true, text: "statement", matchedText: "a single command to be executed" },
      { correct: true, text: "identifier", matchedText: "name of a variable" },
    ]);
    expect(question.matchDistractors).toEqual(["reserved word", "other distractor"]);
  });

  it("a blank line between the question text and its matching lines does not make it dropdowns", () => {
    const question = parseOnlyQuestion(`Match these


^ statement - a single command to be executed
^ identifier - name of a variable`);

    expect(question.questionType).toBe(QuestionType.MATCHING);
  });

  it("matching markdown is still written without blank lines", () => {
    const question = parseOnlyQuestion(`Match these

^ statement - a single command to be executed
^ identifier - name of a variable
^ - reserved word`);

    expect(quizQuestionMarkdownUtils.toMarkdown(question)).toContain(`^ statement - a single command to be executed
^ identifier - name of a variable
^ - reserved word`);
  });
});
