import { z } from "zod";
import { zodLocalQuizQuestion } from "./localQuizQuestion";
import { IModuleItem } from "@/features/local/modules/IModuleItem";

export const zodLocalQuiz = z.object({
  name: z.string(),
  description: z.string(),
  password: z
    .string()
    .optional()
    .describe("Password required to access the quiz"),
  unlockAt: z
    .string()
    .optional()
    .describe("Date and time when the quiz becomes available (MM/DD/YYYY HH:MM:SS)"),
  lockAt: z.string().optional(),
  dueAt: z.string(),
  // orders it in its module and day instead of UnlockAt/DueAt
  dateForOrdering: z.string().optional(),
  shuffleAnswers: z.boolean(),
  showCorrectAnswers: z
    .boolean()
    .describe("Whether to show correct answers after submission"),
  oneQuestionAtATime: z.boolean(),
  localAssignmentGroupName: z.string().optional(),
  allowedAttempts: z
    .number()
    .describe("Number of allowed attempts (-1 for unlimited)"),
  timeLimit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Minutes a student has once they start an attempt; no limit when absent"),
  questions: zodLocalQuizQuestion.array(),
});

export interface LocalQuiz extends IModuleItem, z.infer<typeof zodLocalQuiz> {}
