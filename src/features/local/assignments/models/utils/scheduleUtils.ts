// Pure helpers tying a Schedule block to Canvas students. Files store only the
// Canvas id (so no student names live in the repo); "Last, First" and
// "Last, First (id)" are still accepted when reading older files.
import {
  dateToMarkdownString,
  getDateFromString,
} from "@/features/local/utils/timeUtils";
import { AssignmentScheduleEntry, LocalAssignment } from "../localAssignment";

export interface StudentRef {
  id: number;
  sortableName: string;
}

/** Labels as they should be written in a file: "Last, First", plus the id when two students share a name. */
export function studentLabels(students: StudentRef[]): Map<number, string> {
  const countByName = new Map<string, number>();
  for (const s of students)
    countByName.set(s.sortableName, (countByName.get(s.sortableName) ?? 0) + 1);
  return new Map(
    students.map((s) => [
      s.id,
      (countByName.get(s.sortableName) ?? 0) > 1
        ? `${s.sortableName} (${s.id})`
        : s.sortableName,
    ])
  );
}

export function parseStudentLabel(label: string): {
  name: string;
  canvasId?: number;
} {
  const trimmed = label.trim();
  if (/^\d+$/.test(trimmed)) return { name: "", canvasId: parseInt(trimmed) };
  const match = /^(.*?)\s*\((\d+)\)\s*$/.exec(trimmed);
  if (match) return { name: match[1].trim(), canvasId: parseInt(match[2]) };
  return { name: trimmed };
}

/** What gets written in a file for a student: the Canvas id only. */
export function studentFileToken(student: StudentRef): string {
  return String(student.id);
}

/** Name to show for a file token, or the token itself when the roster can't resolve it. */
export function studentDisplayName(
  token: string,
  students: StudentRef[] | undefined
): string {
  if (!students) return token;
  const student = resolveStudentLabel(token, students);
  return student ? (studentLabels(students).get(student.id) ?? student.sortableName) : token;
}

export function resolveStudentLabel(
  label: string,
  students: StudentRef[]
): StudentRef | undefined {
  const { name, canvasId } = parseStudentLabel(label);
  if (canvasId !== undefined) return students.find((s) => s.id === canvasId);
  const matches = students.filter(
    (s) => s.sortableName.toLowerCase() === name.toLowerCase()
  );
  // an ambiguous bare name is treated as unresolved so the file has to say which one
  return matches.length === 1 ? matches[0] : undefined;
}

export interface ResolvedScheduleEntry {
  date: string;
  studentIds: number[];
  labels: string[];
}

export function resolveSchedule(
  schedule: AssignmentScheduleEntry[] | undefined,
  students: StudentRef[]
): {
  entries: ResolvedScheduleEntry[];
  unknown: string[];
  duplicates: string[];
} {
  const unknown: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<number>();
  const entries = (schedule ?? []).map((entry) => {
    const studentIds: number[] = [];
    for (const label of entry.students) {
      const student = resolveStudentLabel(label, students);
      if (!student) {
        unknown.push(label);
        continue;
      }
      if (seen.has(student.id)) {
        duplicates.push(label);
        continue;
      }
      seen.add(student.id);
      studentIds.push(student.id);
    }
    return { date: entry.date, studentIds, labels: entry.students };
  });
  return { entries, unknown, duplicates };
}

/** Students not yet listed anywhere in the schedule (what the editor should offer next). */
export function unscheduledStudents(
  schedule: AssignmentScheduleEntry[] | undefined,
  students: StudentRef[]
): StudentRef[] {
  const listed = new Set(
    (schedule ?? [])
      .flatMap((e) => e.students)
      .map((label) => resolveStudentLabel(label, students)?.id)
      .filter((id): id is number => id !== undefined)
  );
  return students.filter((s) => !listed.has(s.id));
}

/** The scheduled date at the assignment's usual time of day. */
export function scheduledDueDate(entryDate: string, dueAt: string): Date {
  const day = getDateFromString(entryDate);
  const due = getDateFromString(dueAt);
  if (!day) throw new Error(`Invalid Schedule date "${entryDate}"`);
  if (!due) throw new Error(`Invalid DueAt "${dueAt}"`);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    due.getHours(),
    due.getMinutes(),
    due.getSeconds()
  );
}

export interface OverrideSpec {
  title: string;
  student_ids: number[];
  due_at: string; // ISO
  lock_at?: string; // ISO
  unlock_at?: string; // ISO
}

/**
 * One Canvas override per schedule date. Lock keeps the assignment's own
 * due -> lock distance; unlock is carried over unchanged so scheduled students
 * keep seeing the assignment when everyone else does.
 */
export function scheduleToOverrides(
  assignment: Pick<LocalAssignment, "dueAt" | "lockAt" | "unlockAt" | "schedule">,
  students: StudentRef[]
): { overrides: OverrideSpec[]; unknown: string[]; duplicates: string[] } {
  const { entries, unknown, duplicates } = resolveSchedule(
    assignment.schedule,
    students
  );
  const due = getDateFromString(assignment.dueAt);
  const lock = assignment.lockAt ? getDateFromString(assignment.lockAt) : undefined;
  const unlock = assignment.unlockAt
    ? getDateFromString(assignment.unlockAt)
    : undefined;
  const lockOffset = due && lock ? lock.getTime() - due.getTime() : undefined;

  const overrides = entries
    .filter((e) => e.studentIds.length > 0)
    .map((entry) => {
      const scheduledDue = scheduledDueDate(entry.date, assignment.dueAt);
      const spec: OverrideSpec = {
        title: `Scheduled ${entry.date}`,
        student_ids: entry.studentIds,
        due_at: scheduledDue.toISOString(),
      };
      if (lockOffset !== undefined)
        spec.lock_at = new Date(scheduledDue.getTime() + lockOffset).toISOString();
      if (unlock) spec.unlock_at = unlock.toISOString();
      return spec;
    });
  return { overrides, unknown, duplicates };
}

/** Does a Canvas override cover exactly these students at this due time (to the minute)? */
export function overrideMatches(
  override: { student_ids?: number[]; due_at?: string },
  spec: OverrideSpec
): boolean {
  const ids = [...(override.student_ids ?? [])].sort((a, b) => a - b);
  const wanted = [...spec.student_ids].sort((a, b) => a - b);
  if (ids.length !== wanted.length || ids.some((id, i) => id !== wanted[i]))
    return false;
  if (!override.due_at) return false;
  const toMinute = (iso: string) =>
    dateToMarkdownString(new Date(iso)).slice(0, -3);
  return toMinute(override.due_at) === toMinute(spec.due_at);
}
