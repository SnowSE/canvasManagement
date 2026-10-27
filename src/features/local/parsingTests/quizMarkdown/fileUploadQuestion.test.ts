import { describe, expect, it } from "vitest";
import { quizMarkdownUtils } from "../../quizzes/models/utils/quizMarkdownUtils";
import { quizQuestionMarkdownUtils } from "../../quizzes/models/utils/quizQuestionMarkdownUtils";
import { QuestionType } from "../../quizzes/models/localQuizQuestion";
import { getQuestionTypeForCanvas } from "@/features/canvas/services/canvasQuizService";

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

describe("file upload questions", () => {
  it("is a question ending in file_upload or file upload", () => {
    for (const keyword of ["file_upload", "file upload", "File Upload"]) {
      const question = parseOnly(`Points: 10
Upload a screenshot of your running container.
${keyword}`);
      expect(question.questionType).toBe(QuestionType.FILE_UPLOAD);
      expect(question.text).toBe("Upload a screenshot of your running container.");
      expect(question.answers).toEqual([]);
      expect(question.points).toBe(10);
    }
  });

  it("writes the same markdown back out", () => {
    const markdown = `Points: 10
Upload a screenshot of your running container.
file_upload`;
    expect(quizQuestionMarkdownUtils.toMarkdown(parseOnly(markdown))).toBe(markdown);
  });

  it("is a file_upload_question in Canvas", () => {
    expect(
      getQuestionTypeForCanvas(parseOnly(`Upload it.
file_upload`)),
    ).toBe("file_upload_question");
  });
});
