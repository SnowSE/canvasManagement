import { z } from "zod";
import { zodLocalQuizQuestionAnswer } from "./localQuizQuestionAnswer";

export const zodQuestionType = z.enum([
  "multiple_answers",
  "multiple_choice",
  "essay",
  "short_answer",
  "matching",
  "multiple_dropdowns",
  "",
  "short_answer=",
  "numerical",
  "fill_in_multiple_blanks",
  "file_upload",
]);

export const QuestionType = {
  MULTIPLE_ANSWERS: "multiple_answers",
  MULTIPLE_CHOICE: "multiple_choice",
  ESSAY: "essay",
  SHORT_ANSWER: "short_answer",
  MATCHING: "matching",
  MULTIPLE_DROPDOWNS: "multiple_dropdowns",
  NONE: "",
  SHORT_ANSWER_WITH_ANSWERS: "short_answer=",
  NUMERICAL: "numerical",
  FILL_IN_MULTIPLE_BLANKS: "fill_in_multiple_blanks",
  FILE_UPLOAD: "file_upload",
} as const;

export type QuestionType = z.infer<typeof zodQuestionType>;

export const zodQuestionGroup = z.object({
  name: z.string(),
  pickCount: z
    .number()
    .int()
    .positive()
    .describe("How many of the group's questions each student gets"),
});
export type QuestionGroup = z.infer<typeof zodQuestionGroup>;

export const zodLocalQuizQuestion = z.object({
  text: z.string(),
  questionType: zodQuestionType,
  points: z.number(),
  answers: zodLocalQuizQuestionAnswer.array(),
  matchDistractors: z
    .array(z.string())
    .describe("Distractor terms for matching questions"),
  correctComments: z.string().optional(),
  incorrectComments: z.string().optional(),
  neutralComments: z
    .string()
    .optional()
    .describe("Feedback shown regardless of answer"),
  group: zodQuestionGroup
    .optional()
    .describe(
      "Set on every question of a question group; Canvas picks pickCount of them at random for each student, each worth the group's points",
    ),
});
export type LocalQuizQuestion = z.infer<typeof zodLocalQuizQuestion>;
