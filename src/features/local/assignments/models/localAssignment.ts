import { IModuleItem } from "../../modules/IModuleItem";
import {
  AssignmentSubmissionType,
  zodAssignmentSubmissionType,
} from "./assignmentSubmissionType";
import { RubricItem, zodRubricItem } from "./rubricItem";
import { assignmentMarkdownParser } from "./utils/assignmentMarkdownParser";
import { assignmentMarkdownSerializer } from "./utils/assignmentMarkdownSerializer";
import { z } from "zod";

export interface LocalAssignment extends IModuleItem {
  name: string;
  description: string;
  unlockAt?: string; // 08/21/2023 23:59:00
  lockAt?: string; // 08/21/2023 23:59:00
  dueAt: string; // 08/21/2023 23:59:00
  localAssignmentGroupName?: string;
  submissionTypes: AssignmentSubmissionType[];
  allowedFileUploadExtensions: string[];
  rubric: RubricItem[];
  classroom50Slug?: string;
  groupSet?: string;
  gradeIndividually?: boolean;
  schedule?: AssignmentScheduleEntry[];
}

/** One batch of students who share a due date that differs from the assignment's DueAt. */
export interface AssignmentScheduleEntry {
  date: string; // MM/DD/YYYY (date only)
  students: string[]; // Canvas ids as strings (older files: "Last, First" or "Last, First (id)")
}

export const zodAssignmentScheduleEntry = z.object({
  date: z.string().describe("Date only (MM/DD/YYYY) these students are due"),
  students: z
    .string()
    .array()
    .describe("Students as Canvas ids (names are not stored in the file)"),
});

export const zodLocalAssignment = z.object({
  name: z.string(),
  description: z.string(),
  unlockAt: z
    .string()
    .optional()
    .describe(
      "Date and time when the assignment becomes available (MM/DD/YYYY HH:MM:SS)"
    ),
  lockAt: z
    .string()
    .optional()
    .describe("Date and time when the assignment locks (MM/DD/YYYY HH:MM:SS)"),
  dueAt: z.string().describe("Due date and time (MM/DD/YYYY HH:MM:SS)"),
  localAssignmentGroupName: z.string().optional(),
  submissionTypes: zodAssignmentSubmissionType.array(),
  allowedFileUploadExtensions: z.string().array(),
  rubric: zodRubricItem.array(),
  classroom50Slug: z
    .string()
    .optional()
    .describe(
      "Classroom 50 assignment slug; the student accept URL is derived from course classroom50 settings + this slug"
    ),
  groupSet: z
    .string()
    .optional()
    .describe("Canvas student group set name, making this a group assignment"),
  gradeIndividually: z
    .boolean()
    .optional()
    .describe("For group assignments, whether each member gets their own grade"),
  schedule: zodAssignmentScheduleEntry
    .array()
    .optional()
    .describe("Per-student due dates, published as Canvas assignment overrides"),
});

export const localAssignmentMarkdown = {
  parseMarkdown: assignmentMarkdownParser.parseMarkdown,
  toMarkdown: assignmentMarkdownSerializer.toMarkdown,
};
