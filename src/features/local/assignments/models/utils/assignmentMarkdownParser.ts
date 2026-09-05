import {
  getDateFromString,
  verifyDateOrThrow,
  verifyDateStringOrUndefined,
} from "../../../utils/timeUtils";
import { AssignmentSubmissionType } from "../assignmentSubmissionType";
import { AssignmentScheduleEntry, LocalAssignment } from "../localAssignment";
import { RubricItem, RubricRating } from "../rubricItem";
import { extractLabelValue } from "./markdownUtils";
import { getDateOnlyMarkdownString } from "../../../utils/timeUtils";

const parseFileUploadExtensions = (input: string) => {
  const allowedFileUploadExtensions: string[] = [];
  const regex = /- (.+)/;

  const words = input.split("AllowedFileUploadExtensions:");
  if (words.length < 2) return allowedFileUploadExtensions;

  const inputAfterSubmissionTypes = words[1];
  const lines = inputAfterSubmissionTypes
    .split("\n")
    .map((line) => line.trim());

  for (const line of lines) {
    const match = regex.exec(line);
    if (!match) {
      if (line === "") continue;
      else break;
    }

    allowedFileUploadExtensions.push(match[1].trim());
  }

  return allowedFileUploadExtensions;
};

// Schedule:
//   09/18/2026:
//     - Mccormick, Bradley
//     - Ginn, Landon
// Dates are keys indented under Schedule, students are list items indented
// further. The block ends at the first line that is not indented.
const parseSchedule = (input: string): AssignmentScheduleEntry[] => {
  const lines = input.split("\n");
  const start = lines.findIndex((line) => /^Schedule:\s*$/.test(line));
  if (start === -1) return [];

  const entries: AssignmentScheduleEntry[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") continue;
    if (!/^\s/.test(line)) break; // block over

    const dateMatch = /^\s+(\d{1,2}\/\d{1,2}\/\d{4}):\s*$/.exec(line);
    if (dateMatch) {
      const date = getDateFromString(dateMatch[1]);
      if (!date)
        throw new Error(`Invalid Schedule date: "${dateMatch[1]}" (use MM/DD/YYYY)`);
      entries.push({ date: getDateOnlyMarkdownString(date), students: [] });
      continue;
    }

    const studentMatch = /^\s+-\s*(.*)$/.exec(line);
    if (studentMatch) {
      const current = entries[entries.length - 1];
      if (!current)
        throw new Error(
          `Schedule student "${studentMatch[1].trim()}" must be listed under a date`
        );
      const student = studentMatch[1].trim();
      if (student) current.students.push(student);
      continue;
    }

    throw new Error(
      `Unexpected line in Schedule: "${line.trim()}" (expected "MM/DD/YYYY:" or "- Last, First")`
    );
  }
  return entries;
};

const parseBoolean = (raw: string, label: string): boolean | undefined => {
  const value = raw.trim().toLowerCase();
  if (value === "") return undefined;
  if (value === "true" || value === "yes") return true;
  if (value === "false" || value === "no") return false;
  throw new Error(`${label} must be true or false, got "${raw}"`);
};

const pointsPattern = /\s*-\s*(-?\d+(?:\.\d+)?)\s*pt(s)?:/;

const parseIndividualRubricItemMarkdown = (rawMarkdown: string): RubricItem => {
  const match = pointsPattern.exec(rawMarkdown);
  if (!match) {
    throw new Error(`Points not found: ${rawMarkdown}`);
  }
  const points = parseFloat(match[1]);
  const label = rawMarkdown.split(": ").slice(1).join(": ");
  return { points, label };
};

const parseRatingFromMarkdown = (rawMarkdown: string): RubricRating => {
  const match = pointsPattern.exec(rawMarkdown);
  if (!match) {
    throw new Error(`Points not found in rating: ${rawMarkdown}`);
  }
  const points = parseFloat(match[1]);
  const description = rawMarkdown.split(": ").slice(1).join(": ");
  return { points, description };
};

const parseSettings = (input: string) => {
  const rawUnlockAt = extractLabelValue(input, "UnlockAt");
  const rawLockAt = extractLabelValue(input, "LockAt");
  const rawDueAt = extractLabelValue(input, "DueAt");
  const assignmentGroupName = extractLabelValue(input, "AssignmentGroupName");
  const submissionTypes = parseSubmissionTypes(input);
  const fileUploadExtensions = parseFileUploadExtensions(input);
  const classroom50Slug = extractLabelValue(input, "Classroom50Slug");
  const groupSet = extractLabelValue(input, "GroupSet");
  const gradeIndividually = parseBoolean(
    extractLabelValue(input, "GradeIndividually"),
    "GradeIndividually"
  );
  const schedule = parseSchedule(input);

  const dueAt = verifyDateOrThrow(rawDueAt, "DueAt");
  const lockAt = verifyDateStringOrUndefined(rawLockAt);
  const unlockAt = verifyDateStringOrUndefined(rawUnlockAt);

  return {
    assignmentGroupName,
    submissionTypes,
    fileUploadExtensions,
    dueAt,
    unlockAt,
    lockAt,
    classroom50Slug,
    groupSet,
    gradeIndividually,
    schedule,
  };
};

const parseSubmissionTypes = (input: string): AssignmentSubmissionType[] => {
  const submissionTypes: AssignmentSubmissionType[] = [];
  const regex = /- (.+)/;

  const words = input.split("SubmissionTypes:");
  if (words.length < 2) return submissionTypes;

  const inputAfterSubmissionTypes = words[1]; // doesn't consider other settings that follow...
  const lines = inputAfterSubmissionTypes
    .split("\n")
    .map((line) => line.trim());

  for (const line of lines) {
    const match = regex.exec(line);
    if (!match) {
      if (line === "") continue;
      else break;
    }

    const typeString = match[1].trim();
    const type = Object.values(AssignmentSubmissionType).find(
      (t) => t === typeString
    );

    if (type) {
      submissionTypes.push(type);
    } else {
      console.warn(`Unknown submission type: ${typeString}`);
    }
  }

  return submissionTypes;
};

const parseRubricMarkdown = (rawMarkdown: string | undefined): RubricItem[] => {
  if (!rawMarkdown?.trim()) return [];

  const lines = rawMarkdown
    .split("\n")
    .filter((line) => line.trim().length > 0);

  // Find the minimum indentation level among all rubric lines to establish
  // the base indent. Lines at base indent are top-level criteria; lines
  // with more indentation are ratings (sub-scores) for the current criterion.
  const baseIndent = lines.reduce((min, line) => {
    const indent = /^(\s*)/.exec(line)![1].length;
    return Math.min(min, indent);
  }, Infinity);

  return lines
    .reduce<RubricItem[]>((items, line) => {
      const indent = /^(\s*)/.exec(line)![1].length;
      if (indent === baseIndent) {
        return [...items, parseIndividualRubricItemMarkdown(line)];
      }
      if (items.length === 0) return items;
      const last = items[items.length - 1];
      const updated = {
        ...last,
        ratings: [...(last.ratings ?? []), parseRatingFromMarkdown(line)],
      };
      return [...items.slice(0, -1), updated];
    }, []);
};

export const assignmentMarkdownParser = {
  parseRubricMarkdown,
  parseMarkdown(input: string, name: string): LocalAssignment {
    const settingsString = input.split("---")[0];
    const {
      assignmentGroupName,
      submissionTypes,
      fileUploadExtensions,
      dueAt,
      unlockAt,
      lockAt,
      classroom50Slug,
      groupSet,
      gradeIndividually,
      schedule,
    } = parseSettings(settingsString);

    const description = input
      .split("---\n")
      .slice(1)
      .join("---\n")
      .split("## Rubric")[0]
      .trim();

    const rubricString = input.split("## Rubric\n")[1];
    const rubric = parseRubricMarkdown(rubricString);

    const assignment: LocalAssignment = {
      name,
      localAssignmentGroupName: assignmentGroupName.trim(),
      submissionTypes: submissionTypes,
      allowedFileUploadExtensions: fileUploadExtensions,
      dueAt: dueAt,
      unlockAt: unlockAt,
      lockAt: lockAt,
      rubric: rubric,
      description: description,
    };
    if (classroom50Slug) {
      assignment.classroom50Slug = classroom50Slug;
    }
    if (groupSet) {
      assignment.groupSet = groupSet;
    }
    if (gradeIndividually !== undefined) {
      assignment.gradeIndividually = gradeIndividually;
    }
    if (schedule.length > 0) {
      assignment.schedule = schedule;
    }
    return assignment;
  },
};
