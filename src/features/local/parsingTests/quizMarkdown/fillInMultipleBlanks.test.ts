import { QuestionType } from "@/features/local/quizzes/models/localQuizQuestion";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";
import { quizQuestionMarkdownUtils } from "@/features/local/quizzes/models/utils/quizQuestionMarkdownUtils";
import { describe, it, expect } from "vitest";

// Fill in multiple blanks: [ans1]-style placeholders in the question text, and
// one "[ans1] = answer" line per accepted answer, with "= answer" lines adding
// more accepted answers to the blank above them.

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

const addressSpaces = `Points: 3
Identify the following address spaces.

1. Where compiled code is stored [ans1]
2. Dynamic data structure, grows downward [ans2]

[ans1] = Program Code
       = Code
       = code segment
[ans2] = Heap`;

describe("FillInMultipleBlanksTests", () => {
  it("parses blanks and their accepted answers", () => {
    const question = parseOnlyQuestion(addressSpaces);

    expect(question.questionType).toBe(QuestionType.FILL_IN_MULTIPLE_BLANKS);
    expect(question.points).toBe(3);
    expect(question.text).toBe(
      "Identify the following address spaces.\n\n1. Where compiled code is stored [ans1]\n2. Dynamic data structure, grows downward [ans2]\n",
    );
    expect(question.answers).toEqual([
      { correct: true, text: "Program Code", blankId: "ans1" },
      { correct: true, text: "Code", blankId: "ans1" },
      { correct: true, text: "code segment", blankId: "ans1" },
      { correct: true, text: "Heap", blankId: "ans2" },
    ]);
  });

  it("writes the same markdown back out", () => {
    const question = parseOnlyQuestion(addressSpaces);
    expect(quizQuestionMarkdownUtils.toMarkdown(question)).toBe(addressSpaces);
  });

  it("accepts the blank repeated on every line, and writes it grouped", () => {
    const question = parseOnlyQuestion(`Roses are [color1], violets are [color2]
[color1] = red
[color1] = crimson
[color2] = blue`);

    expect(question.answers.map((a) => [a.blankId, a.text])).toEqual([
      ["color1", "red"],
      ["color1", "crimson"],
      ["color2", "blue"],
    ]);
    expect(quizQuestionMarkdownUtils.toMarkdown(question)).toBe(
      `Points: 1
Roses are [color1], violets are [color2]
[color1] = red
         = crimson
[color2] = blue`,
    );
  });

  it("round trips through a whole quiz", () => {
    const quiz = quizMarkdownUtils.parseMarkdown(
      quizWith(addressSpaces),
      "Test Quiz",
    );
    expect(() => quizMarkdownUtils.assertCanRoundTrip(quiz)).not.toThrow();
  });

  it("keeps feedback separate from the answers", () => {
    const question = parseOnlyQuestion(`The [a] is first.
+ Nice
[a] = sun`);

    expect(question.text).toBe("The [a] is first.");
    expect(question.correctComments).toBe("Nice");
    expect(question.answers).toEqual([
      { correct: true, text: "sun", blankId: "a" },
    ]);
  });

  it("does not mistake bracketed text inside a code block for a blank", () => {
    const question = parseOnlyQuestion(`What does this print?
\`\`\`
[x] = 5
\`\`\`
*a) 5
b) 6`);

    expect(question.questionType).toBe(QuestionType.MULTIPLE_CHOICE);
  });

  it("names a blank with answers but no placeholder in the text", () => {
    expect(() =>
      parseOnlyQuestion(`Fill in [ans1].
[ans1] = one
[ans2] = two`),
    ).toThrow(/no \[ans2\]/);
  });

  it("rejects a line after the answers that is not an answer", () => {
    expect(() =>
      parseOnlyQuestion(`Fill in [ans1].
[ans1] = one
short_answer`),
    ).toThrow(/"short_answer" is not a blank's answer/);
  });

  it("rejects an empty answer", () => {
    expect(() =>
      parseOnlyQuestion(`Fill in [ans1].
[ans1] =`),
    ).toThrow(/\[ans1\] has an empty answer/);
  });
});

describe("FillInMultipleBlanks answer keys in comments", () => {
  // the Canvas importer wrote fill-in-multiple-blanks keys into comments on a
  // short_answer question; those must stay a comment, untouched
  const importedQuestion = `Points: 3
Identify the following address spaces.

 - Code is stored [ans1]
 - Grows downward [ans2]

<!-- CANVAS QUESTION TYPE: fill_in_multiple_blanks_question.  Answer key:
     [ans1] = Program Code  (also accepted: Code)
     [ans2] = Heap  -->
short_answer`;

  it("leaves a commented key as part of a short answer question", () => {
    const question = parseOnlyQuestion(importedQuestion);
    expect(question.questionType).toBe(QuestionType.SHORT_ANSWER);
    expect(question.text).toContain("[ans2] = Heap  -->");
    expect(question.answers).toEqual([]);
  });

  it("ignores a one-line comment that looks like an answer", () => {
    const question = parseOnlyQuestion(`Fill in [a].
<!-- [a] = old answer -->
[a] = new answer`);
    expect(question.answers).toEqual([
      { correct: true, text: "new answer", blankId: "a" },
    ]);
    expect(question.text).toBe("Fill in [a].\n<!-- [a] = old answer -->");
  });

  it("allows lines in the question text that look like other answers", () => {
    const question = parseOnlyQuestion(`Finish the sentence.
a) the first part is [p1]
[p1] = done`);
    expect(question.text).toBe("Finish the sentence.\na) the first part is [p1]");
  });
});
