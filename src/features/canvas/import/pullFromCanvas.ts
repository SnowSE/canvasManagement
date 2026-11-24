import { SyncField } from "@/app/course/[courseName]/calendar/day/getAssignmentSyncStatus";
import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import { CanvasQuiz } from "@/features/canvas/models/quizzes/canvasQuizModel";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { CanvasPage } from "@/features/canvas/models/pages/canvasPageModel";
import { toMarkdownDate } from "./canvasImport";
import { pullDescription } from "./pullDescription";

/**
 * Pull from Canvas: the file takes Canvas's value in the rows of the
 * compare page that differ, and nothing else in it changes. A row is
 * pulled by what it sets in the file (`pulls`, by the row's key); the
 * description takes only its blocks that differ (see pullDescription); a
 * row without a way (a rubric, a quiz's questions) is left as it is and
 * listed, so the confirmation can say what stays different.
 */
// what the rows read of Canvas's item, an assignment's or a quiz's
type Canvas = {
  due_at?: string; lock_at?: string; unlock_at?: string; assignment_group_id?: number;
  access_code?: string | null; shuffle_answers?: boolean; show_correct_answers?: boolean;
  one_question_at_a_time?: boolean; allowed_attempts?: number; time_limit?: number | null;
};
type Local = Partial<LocalAssignment & LocalQuiz>;

/** What each row sets in the file from Canvas's item; undefined: Canvas has nothing the file could take. */
const pulls: Record<string, (canvas: Canvas, settings: LocalCourseSettings) => Local | undefined> = {
  // a file always has a due date: one Canvas lacks can't be taken
  dueAt: (c) => (toMarkdownDate(c.due_at) ? { dueAt: toMarkdownDate(c.due_at) } : undefined),
  lockAt: (c) => ({ lockAt: toMarkdownDate(c.lock_at) }),
  unlockAt: (c) => ({ unlockAt: toMarkdownDate(c.unlock_at) }),
  assignmentGroup: (c, settings) => {
    const group = settings.assignmentGroups.find((g) => g.canvasId !== undefined && g.canvasId === c.assignment_group_id);
    return group && { localAssignmentGroupName: group.name };
  },
  password: (c) => ({ password: c.access_code || undefined }),
  shuffleAnswers: (c) => ({ shuffleAnswers: c.shuffle_answers ?? false }),
  showCorrectAnswers: (c) => ({ showCorrectAnswers: c.show_correct_answers ?? false }),
  oneQuestionAtATime: (c) => ({ oneQuestionAtATime: c.one_question_at_a_time ?? false }),
  allowedAttempts: (c) => ({ allowedAttempts: c.allowed_attempts ?? 1 }),
  timeLimit: (c) => ({ timeLimit: c.time_limit || undefined }),
};

/** The file's text a description row compares: an assignment's or quiz's description, a page's whole text. */
const textOf = { assignment: "description", quiz: "description", page: "text" } as const;

export function pullFromCanvas<T extends LocalAssignment | LocalQuiz | LocalCoursePage>(
  type: "assignment" | "quiz" | "page",
  item: T,
  canvasItem: CanvasAssignment | CanvasQuiz | CanvasPage,
  differences: SyncField[],
  settings: LocalCourseSettings,
  /** How the compare page renders the item's description; without it the description is left. */
  render?: (markdown: string) => string,
): { item: T; pulled: SyncField[]; left: SyncField[] } {
  const description = () => {
    const { body, description: canvasDescription } = canvasItem as { body?: string; description?: string };
    const canvasHtml = (type === "page" ? body : canvasDescription) ?? "";
    const text = render && pullDescription((item as unknown as Record<string, string>)[textOf[type]] ?? "", canvasHtml, render);
    return text === undefined ? undefined : { [textOf[type]]: text };
  };
  const taken = differences.map((field) => ({ field, change: field.key === "description" ? description() : pulls[field.key]?.(canvasItem as Canvas, settings) }));
  return {
    item: taken.reduce((next, { change }) => ({ ...next, ...change }), item),
    pulled: taken.filter((t) => t.change).map((t) => t.field),
    left: taken.filter((t) => !t.change).map((t) => t.field),
  };
}

/** The Canvas field each row sends (what Update Canvas calls it); the description's is the item's text there. */
const fieldOf: Record<string, string> = {
  dueAt: "due_at", lockAt: "lock_at", unlockAt: "unlock_at", assignmentGroup: "assignment_group_id",
  password: "access_code", shuffleAnswers: "shuffle_answers", showCorrectAnswers: "show_correct_answers",
  oneQuestionAtATime: "one_question_at_a_time", allowedAttempts: "allowed_attempts", timeLimit: "time_limit",
};

/**
 * Send to Canvas, the mirror of pullFromCanvas: Canvas takes the file's
 * value in the rows asked for and nothing else there changes. `whole` is
 * everything Update Canvas sends for the item, as it sends it; a row's send
 * is its own field of that. A row with no field of its own (a rubric row, a
 * quiz's questions), or none to send (a group Canvas doesn't know yet), is
 * left and listed.
 */
export function sendToCanvas(type: "assignment" | "quiz" | "page", whole: Record<string, unknown>, differences: SyncField[]) {
  const taken = differences.map((field) => {
    const name = field.key === "description" ? (type === "page" ? "body" : "description") : fieldOf[field.key];
    return { field, name: name !== undefined && whole[name] !== undefined ? name : undefined };
  });
  return {
    body: Object.fromEntries(taken.filter((t) => t.name).map((t) => [t.name!, whole[t.name!]])),
    sent: taken.filter((t) => t.name).map((t) => t.field),
    left: taken.filter((t) => !t.name).map((t) => t.field),
  };
}
