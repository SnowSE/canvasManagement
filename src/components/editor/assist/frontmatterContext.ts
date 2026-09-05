// Pure analysis of the settings block above the first "---" in an item file,
// so the editor knows what the cursor is sitting on. No Monaco types here.

export type FrontmatterItemType =
  | "assignment"
  | "quiz"
  | "page"
  | "lecture"
  | "unknown";

export type LineContext =
  | {
      kind: "value";
      key: string;
      /** 1-based column where a value would start (after "Key:" and its spaces) */
      valueStart: number;
      value: string;
      /** true when there is no space after the colon yet */
      needsSpace: boolean;
    }
  | {
      kind: "listItem";
      header: string;
      /** 1-based column where the item text starts (after "- ") */
      itemStart: number;
      text: string;
      /** true for an indented blank line where "- " still has to be typed */
      needsDash: boolean;
      /** for Schedule items: the date they sit under */
      scheduleDate?: string;
    }
  | { kind: "blankKey" }
  | { kind: "scheduleDateKey"; indent: string; date?: string }
  | null;

export const DATE_KEYS = ["DueAt", "LockAt", "UnlockAt", "DueDateForOrdering"];

const keyWithValue = /^([A-Za-z][A-Za-z0-9]*):(\s*)(.*)$/;
const bareKey = /^([A-Za-z][A-Za-z0-9]*):\s*$/;
const listItem = /^(\s*-\s?)(.*)$/;
const dateKey = /^(\s+)(\d{1,2}\/\d{1,2}\/\d{4})?:?\s*$/;

/** Index of the "---" line that closes the frontmatter, or -1 when there is none. */
export function frontmatterEndLine(lines: string[]): number {
  return lines.findIndex((line) => line.trim() === "---");
}

export function frontmatterLines(lines: string[]): string[] {
  const end = frontmatterEndLine(lines);
  return end === -1 ? [] : lines.slice(0, end);
}

export function presentKeys(lines: string[]): Set<string> {
  const keys = new Set<string>();
  for (const line of frontmatterLines(lines)) {
    const match = keyWithValue.exec(line);
    if (match) keys.add(match[1]);
  }
  return keys;
}

export function itemTypeFromFrontmatter(lines: string[]): FrontmatterItemType {
  const keys = presentKeys(lines);
  if (keys.has("DueDateForOrdering")) return "page";
  if (keys.has("ShuffleAnswers") || keys.has("AssignmentGroup")) return "quiz";
  if (
    keys.has("SubmissionTypes") ||
    keys.has("AssignmentGroupName") ||
    keys.has("DueAt")
  )
    return "assignment";
  if (keys.has("Name")) return "lecture";
  return "unknown";
}

/** Walk up from a line to the "Key:" header that owns it (a key with no value). */
function findHeader(
  lines: string[],
  fromIndex: number
): { header: string; scheduleDate?: string } | null {
  let scheduleDate: string | undefined;
  for (let j = fromIndex; j >= 0; j--) {
    const line = lines[j];
    const bare = bareKey.exec(line);
    if (bare) return { header: bare[1], scheduleDate };
    if (/^[A-Za-z][A-Za-z0-9]*:/.test(line)) return null; // a key with a value ends the block
    const date = /^\s+(\d{1,2}\/\d{1,2}\/\d{4}):\s*$/.exec(line);
    if (date && scheduleDate === undefined) scheduleDate = date[1];
  }
  return null;
}

export function getLineContext(lines: string[], lineIndex: number): LineContext {
  const end = frontmatterEndLine(lines);
  if (end === -1 || lineIndex >= end || lineIndex < 0) return null;
  const line = lines[lineIndex];

  const kv = keyWithValue.exec(line);
  if (kv) {
    const [, key, spaces, rest] = kv;
    return {
      kind: "value",
      key,
      valueStart: key.length + 2 + spaces.length,
      value: rest.trim(),
      needsSpace: spaces.length === 0,
    };
  }

  const item = listItem.exec(line);
  if (item) {
    const found = findHeader(lines, lineIndex - 1);
    if (!found) return null;
    return {
      kind: "listItem",
      header: found.header,
      itemStart: item[1].length + 1,
      text: item[2].trim(),
      needsDash: false,
      scheduleDate: found.scheduleDate,
    };
  }

  if (line.length === 0) return { kind: "blankKey" };

  const date = dateKey.exec(line);
  if (date) {
    const found = findHeader(lines, lineIndex - 1);
    if (found?.header !== "Schedule") return null;
    const indent = date[1];
    // a blank line indented like a student is a spot for the next student;
    // a shallower one is a spot for the next date
    if (!date[2] && indent.length >= 3 && !line.includes(":")) {
      return {
        kind: "listItem",
        header: "Schedule",
        itemStart: indent.length + 1,
        text: "",
        needsDash: true,
        scheduleDate: found.scheduleDate,
      };
    }
    return { kind: "scheduleDateKey", indent, date: date[2] };
  }

  return null;
}

export interface ScheduleStudentLine {
  lineIndex: number;
  label: string;
  date?: string;
  /** 1-based column where the label starts */
  column: number;
}

/** Every "- Last, First" line inside the Schedule block. */
export function scheduleStudentLines(lines: string[]): ScheduleStudentLine[] {
  const result: ScheduleStudentLine[] = [];
  const end = frontmatterEndLine(lines);
  for (let i = 0; i < end; i++) {
    const ctx = getLineContext(lines, i);
    if (ctx?.kind === "listItem" && ctx.header === "Schedule" && ctx.text) {
      result.push({
        lineIndex: i,
        label: ctx.text,
        date: ctx.scheduleDate,
        column: ctx.itemStart,
      });
    }
  }
  return result;
}
