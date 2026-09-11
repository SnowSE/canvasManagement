import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import { CanvasRubricCriteria } from "@/features/canvas/models/assignments/canvasRubricCriteria";
import { CanvasPage } from "@/features/canvas/models/pages/canvasPageModel";
import { CanvasQuiz } from "@/features/canvas/models/quizzes/canvasQuizModel";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { RubricItem } from "@/features/local/assignments/models/rubricItem";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import {
  dateToMarkdownString,
  getDateFromString,
} from "@/features/local/utils/timeUtils";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { getClassroomReplaceText } from "@/features/local/classroom50/classroom50UrlUtils";
import { htmlIsCloseEnough } from "@/services/utils/htmlIsCloseEnough";
import { CanvasLinkTargets } from "@/services/urlUtils";
import {
  GroupSetsSnapshot,
  StudentsSnapshot,
} from "@/features/canvas/roster/rosterModels";
import {
  overrideMatches,
  scheduleToOverrides,
} from "@/features/local/assignments/models/utils/scheduleUtils";
import { AssignmentScheduleEntry } from "@/features/local/assignments/models/localAssignment";
import { assignmentPoints } from "@/features/local/assignments/models/utils/assignmentPointsUtils";

/** Roster + group sets from the server cache; undefined while still loading. */
export interface RosterForStatus {
  students?: StudentsSnapshot;
  groupSets?: GroupSetsSnapshot;
}

export type SyncSection =
  | "status"
  | "dates"
  | "grading"
  | "groups"
  | "schedule"
  | "rubric"
  | "description";

/** One compared setting: what the file says, what Canvas has, and whether they agree. */
export interface SyncField {
  key: string;
  label: string;
  section: SyncSection;
  /** Display value from the markdown file ("—" when unset). */
  local: string;
  /** Display value from Canvas ("—" when unset). */
  canvas: string;
  same: boolean;
  /** Short sentence for the calendar tooltip; empty when the field matches. */
  message: string;
}

export interface SyncDescription {
  localHtml: string;
  canvasHtml: string;
  same: boolean;
}

export type ItemSyncStatus = {
  status: "localOnly" | "incomplete" | "published";
  /** The first difference's message (kept for the calendar tooltip and tests). */
  message: string;
  differences: SyncField[];
};

export interface SyncReport extends ItemSyncStatus {
  /** Every compared field, matching or not, in display order. */
  fields: SyncField[];
  /** Rendered file markdown vs the Canvas description; assignments and quizzes only. */
  description?: SyncDescription;
}

const UNSET = "—";

function field(
  partial: Omit<SyncField, "same" | "message"> & {
    same: boolean;
    message?: string;
  },
): SyncField {
  return { ...partial, message: partial.same ? "" : (partial.message ?? "") };
}

function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = getDateFromString(value);
  return date ? dateToMarkdownString(date) : value;
}

function checkPublished(published: boolean | undefined): SyncField {
  return field({
    key: "published",
    label: "Published",
    section: "status",
    local: "published",
    canvas: published ? "published" : "not published",
    same: !!published,
    message: "not published in canvas",
  });
}

/**
 * Optional dates (unlock, lock) are only compared when the file sets them:
 * publishing never clears a date in Canvas, so a Canvas-only date is not
 * something Update Canvas could fix.
 */
function checkOptionalDate(
  key: string,
  label: string,
  localValue: string | undefined,
  canvasValue: string | undefined,
): SyncField | null {
  if (!localValue) return null;
  const local = formatDate(localValue) ?? localValue;
  const canvas = formatDate(canvasValue);
  if (!canvas)
    return field({
      key,
      label,
      section: "dates",
      local,
      canvas: UNSET,
      same: false,
      message: `${label.toLowerCase()} date not in canvas`,
    });
  return field({
    key,
    label,
    section: "dates",
    local,
    canvas,
    same: local === canvas,
    message: `${label.toLowerCase()} date different: ${local} vs ${canvas}`,
  });
}

function checkDueDate(
  localDueAt: string,
  canvasDueAt: string | undefined,
): SyncField {
  const local = formatDate(localDueAt) ?? localDueAt;
  const canvas = formatDate(canvasDueAt);
  if (!canvas)
    return field({
      key: "dueAt",
      label: "Due",
      section: "dates",
      local,
      canvas: UNSET,
      same: false,
      message: "due date not in canvas",
    });
  return field({
    key: "dueAt",
    label: "Due",
    section: "dates",
    local,
    canvas,
    same: local === canvas,
    message: `due date different: ${local} vs ${canvas}`,
  });
}

/** Due, then lock — the order the calendar has always reported them in. */
function checkDueDateAndLock(
  localDueAt: string,
  localLockAt: string | undefined,
  canvasDueAt: string | undefined,
  canvasLockAt: string | undefined,
): SyncField[] {
  const fields: SyncField[] = [];
  const due = checkDueDate(localDueAt, canvasDueAt);
  const lock = checkOptionalDate("lockAt", "Lock", localLockAt, canvasLockAt);
  // a missing due date outranks everything else about dates
  if (!due.same && due.canvas === UNSET) {
    fields.push(due);
    if (lock) fields.push(lock);
    return fields;
  }
  // a missing lock date was reported before a differing due date
  if (lock && !lock.same && lock.canvas === UNSET) {
    fields.push(lock, due);
    return fields;
  }
  fields.push(due);
  if (lock) fields.push(lock);
  return fields;
}

function checkAssignmentGroup(
  localGroupName: string | undefined,
  canvasGroupId: number | undefined,
  settings: LocalCourseSettings,
): SyncField | null {
  if (!localGroupName) return null;
  const assignmentGroup = settings.assignmentGroups.find(
    (g) => g.name === localGroupName,
  );
  const canvasGroup = settings.assignmentGroups.find(
    (g) => g.canvasId === canvasGroupId,
  );
  const canvas = canvasGroup?.name ?? (canvasGroupId ? `id ${canvasGroupId}` : UNSET);
  if (!assignmentGroup?.canvasId)
    return field({
      key: "assignmentGroup",
      label: "Assignment group",
      section: "grading",
      local: localGroupName,
      canvas,
      same: false,
      message: "assignment group not found in canvas",
    });
  return field({
    key: "assignmentGroup",
    label: "Assignment group",
    section: "grading",
    local: localGroupName,
    canvas,
    same: canvasGroupId === assignmentGroup.canvasId,
    message: "assignment group is different",
  });
}

/** Canvas reports points on every real assignment; skip when it doesn't. */
function checkPoints(
  localRubric: RubricItem[],
  canvasPoints: number | undefined,
): SyncField | null {
  if (canvasPoints === undefined || canvasPoints === null) return null;
  const local = assignmentPoints(localRubric);
  const canvas = canvasPoints;
  return field({
    key: "points",
    label: "Points",
    section: "grading",
    local: String(local),
    canvas: String(canvas),
    same: local === canvas,
    message: `points different: ${local} vs ${canvas}`,
  });
}

function checkRubric(
  localRubric: RubricItem[],
  canvasRubric: CanvasRubricCriteria[] | undefined,
): SyncField[] {
  const fields: SyncField[] = [];
  const canvasItems = canvasRubric ?? [];
  if (localRubric.length !== canvasItems.length) {
    fields.push(
      field({
        key: "rubricCount",
        label: "Rubric rows",
        section: "rubric",
        local: String(localRubric.length),
        canvas: String(canvasItems.length),
        same: false,
        message: "rubric count is different",
      }),
    );
  }

  const rows = Math.max(localRubric.length, canvasItems.length);
  for (let i = 0; i < rows; i++) {
    const local = localRubric[i];
    const canvas = canvasItems[i];
    const label = `Rubric ${i + 1}` + (local ? ` · ${local.label}` : "");
    fields.push(
      field({
        key: `rubric:${i}`,
        label,
        section: "rubric",
        local: local ? `${local.label} · ${local.points} pts` : UNSET,
        canvas: canvas
          ? `${canvas.description} · ${canvas.points} pts`
          : UNSET,
        same:
          !!local &&
          !!canvas &&
          local.label === canvas.description &&
          local.points === canvas.points,
        message: "rubric description or points is different",
      }),
    );

    if (!local || !canvas || !local.ratings || local.ratings.length === 0)
      continue;
    const canvasRatings = canvas.ratings ?? [];
    if (local.ratings.length !== canvasRatings.length) {
      fields.push(
        field({
          key: `rubric:${i}:ratingCount`,
          label: `Rubric ${i + 1} ratings`,
          section: "rubric",
          local: String(local.ratings.length),
          canvas: String(canvasRatings.length),
          same: false,
          message: "rubric ratings count is different",
        }),
      );
    }
    const ratingRows = Math.max(local.ratings.length, canvasRatings.length);
    for (let j = 0; j < ratingRows; j++) {
      const lr = local.ratings[j];
      const cr = canvasRatings[j];
      fields.push(
        field({
          key: `rubric:${i}:rating:${j}`,
          label: `Rubric ${i + 1} rating ${j + 1}`,
          section: "rubric",
          local: lr ? `${lr.description} · ${lr.points}` : UNSET,
          canvas: cr ? `${cr.description} · ${cr.points}` : UNSET,
          same:
            !!lr &&
            !!cr &&
            lr.description === cr.description &&
            lr.points === cr.points,
          message: "rubric rating description or points is different",
        }),
      );
    }
  }
  return fields;
}

function checkDescription(
  render: () => string,
  canvasHtml: string | undefined,
): { field: SyncField; description: SyncDescription } {
  let localHtml = "";
  let same = false;
  let message = "Canvas description is different";
  try {
    localHtml = render();
    same = htmlIsCloseEnough(localHtml, canvasHtml ?? "");
  } catch (exception) {
    message = "Error parsing markdown " + exception;
  }
  return {
    field: field({
      key: "description",
      label: "Description",
      section: "description",
      local: "rendered from markdown",
      canvas: "current description",
      same,
      message,
    }),
    description: { localHtml, canvasHtml: canvasHtml ?? "", same },
  };
}

function checkGroupSet(
  assignment: LocalAssignment,
  canvasAssignment: CanvasAssignment,
  roster?: RosterForStatus,
): SyncField[] {
  const groupSets = roster?.groupSets?.groupSets;
  const canvasSet = groupSets?.find(
    (g) => g.id === canvasAssignment.group_category_id,
  );
  const canvasSetName =
    canvasSet?.name ??
    (canvasAssignment.group_category_id
      ? `id ${canvasAssignment.group_category_id}`
      : UNSET);

  if (!assignment.groupSet) {
    return [
      field({
        key: "groupSet",
        label: "Group set",
        section: "groups",
        local: UNSET,
        canvas: canvasSetName,
        same: !canvasAssignment.group_category_id,
        message: "canvas has a group set but the file has no GroupSet",
      }),
    ];
  }
  if (!groupSets) return []; // still loading, don't flag
  const groupSet = groupSets.find(
    (g) => g.name.toLowerCase() === assignment.groupSet!.toLowerCase(),
  );
  if (!groupSet)
    return [
      field({
        key: "groupSet",
        label: "Group set",
        section: "groups",
        local: assignment.groupSet,
        canvas: canvasSetName,
        same: false,
        message: `group set "${assignment.groupSet}" not found in canvas`,
      }),
    ];
  const localIndividually = assignment.gradeIndividually ?? false;
  const canvasIndividually =
    canvasAssignment.grade_group_students_individually ?? false;
  const describe = (individually: boolean) =>
    individually ? "graded individually" : "one grade per group";
  return [
    field({
      key: "groupSet",
      label: "Group set",
      section: "groups",
      local: assignment.groupSet,
      canvas: canvasSetName,
      same: canvasAssignment.group_category_id === groupSet.id,
      message: "group set differs in canvas",
    }),
    field({
      key: "gradeIndividually",
      label: "Group grading",
      section: "groups",
      local: describe(localIndividually),
      canvas: describe(canvasIndividually),
      same: localIndividually === canvasIndividually,
      message: "grade individually setting differs in canvas",
    }),
  ];
}

function scheduleEntryField(
  assignment: LocalAssignment,
  entry: AssignmentScheduleEntry,
  canvasAssignment: CanvasAssignment,
  students: NonNullable<StudentsSnapshot["students"]>,
): SyncField {
  const key = `schedule:${entry.date}`;
  const label = `Schedule ${entry.date}`;
  const local = `${entry.students.length} student${entry.students.length === 1 ? "" : "s"}`;
  const { overrides, unknown, duplicates } = scheduleToOverrides(
    { ...assignment, schedule: [entry] },
    students,
  );
  if (unknown.length > 0)
    return field({
      key,
      label,
      section: "schedule",
      local,
      canvas: UNSET,
      same: false,
      message: `not in the canvas roster: ${unknown.join(", ")}`,
    });
  if (duplicates.length > 0)
    return field({
      key,
      label,
      section: "schedule",
      local,
      canvas: UNSET,
      same: false,
      message: `listed more than once: ${duplicates.join(", ")}`,
    });
  if (overrides.length === 0)
    return field({
      key,
      label,
      section: "schedule",
      local,
      canvas: "no override needed",
      same: true,
    });
  const matched = (canvasAssignment.overrides ?? []).some((o) =>
    overrideMatches(o, overrides[0]),
  );
  return field({
    key,
    label,
    section: "schedule",
    local,
    canvas: matched ? "override matches" : "override missing or different",
    same: matched,
    message: `canvas override for ${entry.date} missing or different`,
  });
}

/** Status of one Schedule date's students against the assignment's Canvas overrides. */
export function getScheduleEntryStatus(
  assignment: LocalAssignment,
  entry: AssignmentScheduleEntry,
  canvasAssignment: CanvasAssignment | undefined,
  roster?: RosterForStatus,
): ItemSyncStatus {
  if (!canvasAssignment)
    return { status: "localOnly", message: "not in canvas", differences: [] };
  const students = roster?.students?.students;
  if (!students) return { status: "published", message: "", differences: [] }; // roster loading
  const entryField = scheduleEntryField(
    assignment,
    entry,
    canvasAssignment,
    students,
  );
  if (entryField.same)
    return { status: "published", message: "", differences: [] };
  return {
    status: "incomplete",
    message: entryField.message,
    differences: [entryField],
  };
}

function checkSchedule(
  assignment: LocalAssignment,
  canvasAssignment: CanvasAssignment,
  roster?: RosterForStatus,
): SyncField[] {
  const entries = assignment.schedule ?? [];
  const students = roster?.students?.students;
  if (!students) return [];
  const fields = entries.map((entry) =>
    scheduleEntryField(assignment, entry, canvasAssignment, students),
  );
  // student overrides in canvas that the file no longer has
  const wanted = scheduleToOverrides(assignment, students).overrides;
  const extra = (canvasAssignment.overrides ?? []).filter(
    (o) =>
      o.student_ids &&
      o.student_ids.length > 0 &&
      !wanted.some((w) => overrideMatches(o, w)),
  );
  if (extra.length > 0 || entries.length > 0)
    fields.push(
      field({
        key: "schedule:extra",
        label: "Other student overrides",
        section: "schedule",
        local: "none",
        canvas:
          extra.length === 0
            ? "none"
            : `${extra.length} override${extra.length === 1 ? "" : "s"}`,
        same: extra.length === 0,
        message: `canvas has ${extra.length} student override(s) not in the schedule`,
      }),
    );
  return fields;
}

function checkAssignment(
  assignment: LocalAssignment,
  canvasAssignment: CanvasAssignment,
  settings: LocalCourseSettings,
  canvasLinkTargets?: CanvasLinkTargets,
  roster?: RosterForStatus,
): { fields: SyncField[]; description: SyncDescription } {
  const fields: SyncField[] = [];
  const unlock = checkOptionalDate(
    "unlockAt",
    "Unlock",
    assignment.unlockAt,
    canvasAssignment.unlock_at,
  );
  if (unlock) fields.push(unlock);
  fields.push(...checkGroupSet(assignment, canvasAssignment, roster));
  fields.push(...checkSchedule(assignment, canvasAssignment, roster));
  fields.push(
    ...checkDueDateAndLock(
      assignment.dueAt,
      assignment.lockAt,
      canvasAssignment.due_at,
      canvasAssignment.lock_at,
    ),
  );
  const group = checkAssignmentGroup(
    assignment.localAssignmentGroupName,
    canvasAssignment.assignment_group_id,
    settings,
  );
  if (group) fields.push(group);
  fields.push(...checkRubric(assignment.rubric, canvasAssignment.rubric));
  const points = checkPoints(
    assignment.rubric,
    canvasAssignment.points_possible,
  );
  if (points) fields.push(points);
  const description = checkDescription(
    () =>
      markdownToHTMLSafe({
        markdownString: assignment.description,
        settings,
        replaceText: getClassroomReplaceText({ assignment, settings }),
        canvasLinkTargets,
      }),
    canvasAssignment.description,
  );
  fields.push(description.field);
  return { fields, description: description.description };
}

function checkQuiz(
  quiz: LocalQuiz,
  canvasQuiz: CanvasQuiz,
  settings: LocalCourseSettings,
  canvasLinkTargets?: CanvasLinkTargets,
): { fields: SyncField[]; description: SyncDescription } {
  const fields: SyncField[] = [];
  const unlock = checkOptionalDate(
    "unlockAt",
    "Unlock",
    quiz.unlockAt,
    canvasQuiz.unlock_at,
  );
  if (unlock) fields.push(unlock);
  fields.push(
    ...checkDueDateAndLock(
      quiz.dueAt,
      quiz.lockAt,
      canvasQuiz.due_at,
      canvasQuiz.lock_at,
    ),
  );
  const group = checkAssignmentGroup(
    quiz.localAssignmentGroupName,
    canvasQuiz.assignment_group_id,
    settings,
  );
  if (group) fields.push(group);
  const description = checkDescription(
    () =>
      markdownToHTMLSafe({
        markdownString: quiz.description,
        settings,
        canvasLinkTargets,
      }),
    canvasQuiz.description,
  );
  fields.push(description.field);
  return { fields, description: description.description };
}

function buildReport(
  fields: SyncField[],
  description?: SyncDescription,
): SyncReport {
  const differences = fields.filter((f) => !f.same);
  return {
    status: differences.length > 0 ? "incomplete" : "published",
    message: differences[0]?.message ?? "",
    differences,
    fields,
    description,
  };
}

/**
 * Compares a local item with its Canvas copy field by field. `status` and
 * `message` drive the calendar border and tooltip; `fields` and `description`
 * feed the compare page.
 */
export function getSyncReport({
  item,
  canvasItem,
  type,
  settings,
  canvasLinkTargets,
  roster,
}: {
  item: LocalQuiz | LocalAssignment | LocalCoursePage;
  canvasItem: CanvasQuiz | CanvasAssignment | CanvasPage | undefined;
  type: "assignment" | "page" | "quiz";
  settings: LocalCourseSettings;
  canvasLinkTargets?: CanvasLinkTargets;
  roster?: RosterForStatus;
}): SyncReport {
  if (!canvasItem)
    return {
      status: "localOnly",
      message: "not in canvas",
      differences: [],
      fields: [],
    };

  const fields: SyncField[] = [checkPublished(canvasItem.published)];

  if (type === "page") return buildReport(fields);

  const checked =
    type === "quiz"
      ? checkQuiz(
          item as LocalQuiz,
          canvasItem as CanvasQuiz,
          settings,
          canvasLinkTargets,
        )
      : checkAssignment(
          item as LocalAssignment,
          canvasItem as CanvasAssignment,
          settings,
          canvasLinkTargets,
          roster,
        );
  fields.push(...checked.fields);
  return buildReport(fields, checked.description);
}

export function getSyncStatus(
  args: Parameters<typeof getSyncReport>[0],
): ItemSyncStatus {
  const { status, message, differences } = getSyncReport(args);
  return { status, message, differences };
}
