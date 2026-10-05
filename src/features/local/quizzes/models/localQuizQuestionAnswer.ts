import { z } from "zod";

export const zodLocalQuizQuestionAnswer = z.object({
  correct: z.boolean(),
  text: z.string(),
  matchedText: z
    .string()
    .optional()
    .describe("Matching pair text for matching and multiple dropdowns questions"),
  dropdownGroup: z
    .number()
    .optional()
    .describe(
      "Multiple dropdowns questions: which blank-line-separated group this line is in; each prompt's dropdown offers every answer in its group",
    ),
  numericalAnswerType: z
    .enum(["exact_answer", "range_answer", "precision_answer"])
    .optional(),
  numericAnswer: z.number().optional(),
  numericAnswerRangeMin: z
    .number()
    .optional()
    .describe("Minimum value for range answers"),
  numericAnswerRangeMax: z
    .number()
    .optional()
    .describe("Maximum value for range answers"),
  numericAnswerMargin: z
    .number()
    .optional()
    .describe("Allowed margin for precision answers"),
});

export type LocalQuizQuestionAnswer = z.infer<
  typeof zodLocalQuizQuestionAnswer
>;
