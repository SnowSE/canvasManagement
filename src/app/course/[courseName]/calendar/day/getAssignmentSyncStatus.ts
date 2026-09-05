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
  getDateFromStringOrThrow,
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

/** Roster + group sets from the server cache; undefined while still loading. */
export interface RosterForStatus {
  students?: StudentsSnapshot;
  groupSets?: GroupSetsSnapshot;
}

export type ItemSyncStatus = {
  status: "localOnly" | "incomplete" | "published";
  message: string;
};

function checkPublished(published: boolean | undefined): ItemSyncStatus | null {
  if (!published)
    return { status: "incomplete", message: "not published in canvas" };
  return null;
}

function checkDueDateAndLock(
  localDueAt: string,
  localLockAt: string | undefined,
  canvasDueAt: string | undefined,
  canvasLockAt: string | undefined,
): ItemSyncStatus | null {
  if (!canvasDueAt)
    return { status: "incomplete", message: "due date not in canvas" };

  if (localLockAt && !canvasLockAt)
    return { status: "incomplete", message: "lock date not in canvas" };

  const localDueDate = dateToMarkdownString(
    getDateFromStringOrThrow(localDueAt, "comparing due dates for day"),
  );
  const canvasDueDate = dateToMarkdownString(
    getDateFromStringOrThrow(canvasDueAt, "comparing canvas due date for day"),
  );
  if (localDueDate !== canvasDueDate) {
    return {
      status: "incomplete",
      message: `due date different: ${localDueDate} vs ${canvasDueDate}`,
    };
  }

  return null;
}

function checkRubric(
  localRubric: RubricItem[],
  canvasRubric: CanvasRubricCriteria[] | undefined,
): ItemSyncStatus | null {
  const canvasCount = canvasRubric?.length ?? 0;
  if (localRubric.length !== canvasCount) {
    return { status: "incomplete", message: "rubric count is different" };
  }

  for (let i = 0; i < localRubric.length; i++) {
    const local = localRubric[i];
    const canvas = canvasRubric![i];

    if (local.label !== canvas.description || local.points !== canvas.points) {
      return { status: "incomplete", message: "rubric description or points is different" };
    }

    if (local.ratings && local.ratings.length > 0) {
      const canvasRatings = canvas.ratings ?? [];
      if (local.ratings.length !== canvasRatings.length) {
        return { status: "incomplete", message: "rubric ratings count is different" };
      }
      for (let j = 0; j < local.ratings.length; j++) {
        const lr = local.ratings[j];
        const cr = canvasRatings[j];
        if (lr.description !== cr.description || lr.points !== cr.points) {
          return { status: "incomplete", message: "rubric rating description or points is different" };
        }
      }
    }
  }

  return null;
}

function checkPage(_page: LocalCoursePage, _canvasPage: CanvasPage): null {
  return null;
}

function checkQuiz(
  quiz: LocalQuiz,
  canvasQuiz: CanvasQuiz,
): ItemSyncStatus | null {
  if (quiz.unlockAt && !canvasQuiz.unlock_at)
    return { status: "incomplete", message: "unlock date not in canvas" };

  return checkDueDateAndLock(
    quiz.dueAt,
    quiz.lockAt,
    canvasQuiz.due_at,
    canvasQuiz.lock_at,
  );
}

function checkGroupSet(
  assignment: LocalAssignment,
  canvasAssignment: CanvasAssignment,
  roster?: RosterForStatus,
): ItemSyncStatus | null {
  if (!assignment.groupSet) {
    if (canvasAssignment.group_category_id)
      return {
        status: "incomplete",
        message: "canvas has a group set but the file has no GroupSet",
      };
    return null;
  }
  const groupSets = roster?.groupSets?.groupSets;
  if (!groupSets) return null; // still loading, don't flag
  const groupSet = groupSets.find(
    (g) => g.name.toLowerCase() === assignment.groupSet!.toLowerCase(),
  );
  if (!groupSet)
    return {
      status: "incomplete",
      message: `group set "${assignment.groupSet}" not found in canvas`,
    };
  if (canvasAssignment.group_category_id !== groupSet.id)
    return { status: "incomplete", message: "group set differs in canvas" };
  if (
    (canvasAssignment.grade_group_students_individually ?? false) !==
    (assignment.gradeIndividually ?? false)
  )
    return {
      status: "incomplete",
      message: "grade individually setting differs in canvas",
    };
  return null;
}

/** Status of one Schedule date's students against the assignment's Canvas overrides. */
export function getScheduleEntryStatus(
  assignment: LocalAssignment,
  entry: AssignmentScheduleEntry,
  canvasAssignment: CanvasAssignment | undefined,
  roster?: RosterForStatus,
): ItemSyncStatus {
  if (!canvasAssignment) return { status: "localOnly", message: "not in canvas" };
  const students = roster?.students?.students;
  if (!students) return { status: "published", message: "" }; // roster loading
  const { overrides, unknown, duplicates } = scheduleToOverrides(
    { ...assignment, schedule: [entry] },
    students,
  );
  if (unknown.length > 0)
    return {
      status: "incomplete",
      message: `not in the canvas roster: ${unknown.join(", ")}`,
    };
  if (duplicates.length > 0)
    return {
      status: "incomplete",
      message: `listed more than once: ${duplicates.join(", ")}`,
    };
  if (overrides.length === 0) return { status: "published", message: "" };
  const matched = (canvasAssignment.overrides ?? []).some((o) =>
    overrideMatches(o, overrides[0]),
  );
  if (!matched)
    return {
      status: "incomplete",
      message: `canvas override for ${entry.date} missing or different`,
    };
  return { status: "published", message: "" };
}

function checkSchedule(
  assignment: LocalAssignment,
  canvasAssignment: CanvasAssignment,
  roster?: RosterForStatus,
): ItemSyncStatus | null {
  const entries = assignment.schedule ?? [];
  const students = roster?.students?.students;
  if (!students) return null;
  for (const entry of entries) {
    const entryStatus = getScheduleEntryStatus(
      assignment,
      entry,
      canvasAssignment,
      roster,
    );
    if (entryStatus.status !== "published") return entryStatus;
  }
  // student overrides in canvas that the file no longer has
  const wanted = scheduleToOverrides(assignment, students).overrides;
  const extra = (canvasAssignment.overrides ?? []).filter(
    (o) =>
      o.student_ids &&
      o.student_ids.length > 0 &&
      !wanted.some((w) => overrideMatches(o, w)),
  );
  if (extra.length > 0)
    return {
      status: "incomplete",
      message: `canvas has ${extra.length} student override(s) not in the schedule`,
    };
  return null;
}

function checkAssignment(
  assignment: LocalAssignment,
  canvasAssignment: CanvasAssignment,
  settings: LocalCourseSettings,
  canvasLinkTargets?: CanvasLinkTargets,
  roster?: RosterForStatus,
): ItemSyncStatus | null {
  if (assignment.unlockAt && !canvasAssignment.unlock_at)
    return { status: "incomplete", message: "unlock date not in canvas" };

  const groupStatus = checkGroupSet(assignment, canvasAssignment, roster);
  if (groupStatus) return groupStatus;

  const scheduleStatus = checkSchedule(assignment, canvasAssignment, roster);
  if (scheduleStatus) return scheduleStatus;

  const dueLockStatus = checkDueDateAndLock(
    assignment.dueAt,
    assignment.lockAt,
    canvasAssignment.due_at,
    canvasAssignment.lock_at,
  );
  if (dueLockStatus) return dueLockStatus;

  if (assignment.localAssignmentGroupName) {
    const assignmentGroup = settings.assignmentGroups.find(
      (g) => g.name === assignment.localAssignmentGroupName,
    );
    if (!assignmentGroup?.canvasId) {
      return {
        status: "incomplete",
        message: "assignment group not found in canvas",
      };
    }
    if (canvasAssignment.assignment_group_id !== assignmentGroup.canvasId) {
      return { status: "incomplete", message: "assignment group is different" };
    }
  }

  const rubricStatus = checkRubric(
    assignment.rubric,
    canvasAssignment.rubric,
  );
  if (rubricStatus) return rubricStatus;

  try {
    const htmlIsSame = htmlIsCloseEnough(
      markdownToHTMLSafe({
        markdownString: assignment.description,
        settings,
        replaceText: getClassroomReplaceText({ assignment, settings }),
        canvasLinkTargets,
      }),
      canvasAssignment.description,
    );
    if (!htmlIsSame)
      return {
        status: "incomplete",
        message: "Canvas description is different",
      };
  } catch (exception) {
    return {
      status: "incomplete",
      message: "Error parsing markdown " + exception,
    };
  }

  return null;
}

export function getSyncStatus({
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
}): ItemSyncStatus {
  if (!canvasItem) return { status: "localOnly", message: "not in canvas" };

  const publishedStatus = checkPublished(canvasItem.published);
  if (publishedStatus) return publishedStatus;

  let typeStatus: ItemSyncStatus | null;
  if (type === "page") {
    typeStatus = checkPage(item as LocalCoursePage, canvasItem as CanvasPage);
  } else if (type === "quiz") {
    typeStatus = checkQuiz(item as LocalQuiz, canvasItem as CanvasQuiz);
  } else {
    typeStatus = checkAssignment(
      item as LocalAssignment,
      canvasItem as CanvasAssignment,
      settings,
      canvasLinkTargets,
      roster,
    );
  }

  return typeStatus ?? { status: "published", message: "" };
}
