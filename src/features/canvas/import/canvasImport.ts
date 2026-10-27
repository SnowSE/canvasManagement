import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import { CanvasModule } from "@/features/canvas/models/modules/canvasModule";
import { CanvasPage } from "@/features/canvas/models/pages/canvasPageModel";
import { CanvasQuiz } from "@/features/canvas/models/quizzes/canvasQuizModel";
import { CanvasQuizQuestion } from "@/features/canvas/models/quizzes/canvasQuizQuestionModel";
import { canvasModuleNames } from "@/features/canvas/services/canvasModuleService";
import {
  AssignmentSubmissionType,
  AssignmentSubmissionTypeList,
} from "@/features/local/assignments/models/assignmentSubmissionType";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { RubricItem } from "@/features/local/assignments/models/rubricItem";
import { assignmentMarkdownParser } from "@/features/local/assignments/models/utils/assignmentMarkdownParser";
import { assignmentMarkdownSerializer } from "@/features/local/assignments/models/utils/assignmentMarkdownSerializer";
import { LocalCoursePage, localPageMarkdownUtils } from "@/features/local/pages/localCoursePageModels";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import {
  LocalQuizQuestion,
  QuestionType,
} from "@/features/local/quizzes/models/localQuizQuestion";
import { LocalQuizQuestionAnswer } from "@/features/local/quizzes/models/localQuizQuestionAnswer";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";
import { quizQuestionMarkdownUtils } from "@/features/local/quizzes/models/utils/quizQuestionMarkdownUtils";
import {
  dateToMarkdownString,
  getDateFromString,
} from "@/features/local/utils/timeUtils";
import { validateFileName } from "@/services/fileNameValidation";
import { canvasHtmlToMarkdown, canvasHtmlToPlainText } from "./canvasHtmlToMarkdown";

export type ImportItemType = "assignment" | "quiz" | "page";

/** A Canvas item with no file of the same name in the course. */
export interface ImportCandidate {
  key: string;
  type: ImportItemType;
  canvasId: number;
  name: string;
  /** MM/DD/YYYY HH:mm:ss, when Canvas has a due date. */
  dueAt?: string;
  points?: number;
  canvasAssignmentGroupId?: number;
  /** The Canvas modules holding the item, in module order. */
  canvasModules: string[];
  published: boolean;
  htmlUrl?: string;
  questionCount?: number;
  /** A New Quizzes quiz (a Canvas assignment); imports as a classic quiz file. */
  newQuiz?: boolean;
  /** Why the name can't be a file name; empty when it can. */
  nameError: string;
}

export const toMarkdownDate = (value: string | undefined) => {
  if (!value) return undefined;
  const date = getDateFromString(value);
  return date ? dateToMarkdownString(date) : undefined;
};

/**
 * What Canvas has that the course files don't: items are matched by name,
 * the same way the calendar matches them. A quiz's own assignment is the
 * quiz, so it is left out of the assignments, and so is a New Quizzes quiz,
 * which Canvas keeps as an assignment: it is listed with the quizzes.
 */
export function findImportCandidates({
  canvasAssignments,
  canvasQuizzes,
  canvasPages,
  canvasModules,
  localNames,
}: {
  canvasAssignments: CanvasAssignment[];
  canvasQuizzes: CanvasQuiz[];
  canvasPages: CanvasPage[];
  canvasModules: CanvasModule[];
  localNames: Record<ImportItemType, Set<string>>;
}): ImportCandidate[] {
  const modulesOf = (
    type: ImportItemType,
    item: { id?: number; url?: string; discussion_topic?: { id: number } },
  ) => canvasModuleNames(canvasModules, type, item);

  const assignments = canvasAssignments
    .filter(
      (a) =>
        !a.is_quiz_assignment &&
        !a.is_quiz_lti_assignment &&
        !a.quiz_id &&
        !a.submission_types?.includes("online_quiz") &&
        !localNames.assignment.has(a.name),
    )
    .map(
      (a): ImportCandidate => ({
        key: `assignment:${a.id}`,
        type: "assignment",
        canvasId: a.id,
        name: a.name,
        dueAt: toMarkdownDate(a.due_at),
        points: a.points_possible ?? undefined,
        canvasAssignmentGroupId: a.assignment_group_id,
        canvasModules: modulesOf("assignment", a),
        published: a.published,
        htmlUrl: a.html_url,
        nameError: validateFileName(a.name),
      }),
    );

  const quizzes = canvasQuizzes
    .filter((q) => !localNames.quiz.has(q.title))
    .map(
      (q): ImportCandidate => ({
        key: `quiz:${q.id}`,
        type: "quiz",
        canvasId: q.id,
        name: q.title,
        dueAt: toMarkdownDate(q.due_at),
        points: q.points_possible ?? undefined,
        canvasAssignmentGroupId: q.assignment_group_id,
        canvasModules: modulesOf("quiz", q),
        published: q.published ?? false,
        htmlUrl: q.html_url,
        questionCount: q.question_count,
        nameError: validateFileName(q.title),
      }),
    );

  const newQuizzes = canvasAssignments
    .filter((a) => a.is_quiz_lti_assignment && !localNames.quiz.has(a.name))
    .map(
      (a): ImportCandidate => ({
        key: `newQuiz:${a.id}`,
        type: "quiz",
        canvasId: a.id,
        name: a.name,
        dueAt: toMarkdownDate(a.due_at),
        points: a.points_possible ?? undefined,
        canvasAssignmentGroupId: a.assignment_group_id,
        // in a module, it is an assignment item
        canvasModules: modulesOf("assignment", a),
        published: a.published,
        htmlUrl: a.html_url,
        newQuiz: true,
        nameError: validateFileName(a.name),
      }),
    );

  const pages = canvasPages
    .filter((p) => !localNames.page.has(p.title))
    .map(
      (p): ImportCandidate => ({
        key: `page:${p.page_id}`,
        type: "page",
        canvasId: p.page_id,
        name: p.title,
        canvasModules: modulesOf("page", p),
        published: p.published,
        nameError: validateFileName(p.title),
      }),
    );

  return [...assignments, ...quizzes, ...newQuizzes, ...pages];
}

/**
 * A date for an item Canvas has no due date for (every page, some
 * assignments): the earliest due date in its Canvas module, else the course
 * start at the default due time.
 */
export function fallbackDateFor(
  candidate: ImportCandidate,
  allCandidatesAndLocal: { dueAt?: string; canvasModules: string[] }[],
  courseStart: string,
  defaultDueTime: { hour: number; minute: number },
): string {
  const module = candidate.canvasModules[0];
  const moduleDates = module
    ? allCandidatesAndLocal
        .filter((c) => c.dueAt && c.canvasModules.includes(module))
        .map((c) => getDateFromString(c.dueAt!)!)
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime())
    : [];
  if (moduleDates.length > 0) return dateToMarkdownString(moduleDates[0]);
  const start = getDateFromString(courseStart) ?? new Date();
  start.setHours(defaultDueTime.hour, defaultDueTime.minute, 0, 0);
  return dateToMarkdownString(start);
}

export interface ImportContext {
  /** The local assignment group name for the item's Canvas group. */
  assignmentGroupName?: string;
  /** Used when Canvas has no due date. */
  fallbackDate: string;
  /** Canvas group set names by id, for group assignments. */
  groupSetNames?: Map<number, string>;
}

export interface Converted<T> {
  item: T;
  /** Things that didn't carry over exactly. */
  warnings: string[];
}

export const dueDateOrFallback = (
  dueAt: string | undefined,
  context: ImportContext,
  warnings: string[],
) => {
  const due = toMarkdownDate(dueAt);
  if (due) return due;
  warnings.push(`Canvas has no due date, so DueAt is ${context.fallbackDate}`);
  return context.fallbackDate;
};

// what Update in Canvas sends for a rubric row with no ratings
const isDefaultRatings = (
  points: number,
  ratings: { points: number; description: string }[],
) =>
  ratings.length === 2 &&
  ratings[0].description === "Full Marks" &&
  ratings[0].points === points &&
  ratings[1].description === "No Marks" &&
  ratings[1].points === 0;

function canvasRubricToLocal(
  canvasAssignment: CanvasAssignment,
  warnings: string[],
): RubricItem[] {
  const rubric = (canvasAssignment.rubric ?? []).map((criterion): RubricItem => {
    const points = criterion.points ?? 0;
    const ratings = (criterion.ratings ?? []).map((r) => ({
      points: r.points,
      description: r.description,
    }));
    return {
      label: criterion.description,
      points,
      ...(ratings.length > 0 &&
        !isDefaultRatings(points, ratings) && { ratings }),
    };
  });
  const points = canvasAssignment.points_possible ?? 0;
  if (rubric.length === 0 && points > 0) {
    // the file's points are its rubric's total
    warnings.push(
      `Canvas has no rubric, so the file has one ${points} point row to keep the points`,
    );
    return [{ label: "Points", points }];
  }
  return rubric;
}

const submissionTypesFromCanvas = (
  types: string[] | undefined,
  warnings: string[],
): AssignmentSubmissionType[] => {
  const known = (types ?? []).filter((t): t is AssignmentSubmissionType =>
    AssignmentSubmissionTypeList.includes(t as AssignmentSubmissionType),
  );
  const unknown = (types ?? []).filter(
    (t) => !known.includes(t as AssignmentSubmissionType),
  );
  if (unknown.length > 0)
    warnings.push(
      `submission type ${unknown.join(", ")} isn't supported in the file and was left out`,
    );
  return known.length > 0 ? known : [AssignmentSubmissionType.NONE];
};

export function canvasAssignmentToLocal(
  canvasAssignment: CanvasAssignment,
  context: ImportContext,
): Converted<LocalAssignment> {
  const warnings: string[] = [];
  const groupSet = canvasAssignment.group_category_id
    ? context.groupSetNames?.get(canvasAssignment.group_category_id)
    : undefined;
  if (canvasAssignment.group_category_id && !groupSet)
    warnings.push(
      "it is a group assignment, but the group set isn't loaded; load group sets in course settings and set GroupSet",
    );
  const studentOverrides = (canvasAssignment.overrides ?? []).filter(
    (o) => o.student_ids && o.student_ids.length > 0,
  );
  if (studentOverrides.length > 0)
    warnings.push(
      `its per-student due dates (${studentOverrides.length} in Canvas) aren't in the file; they stay in Canvas, and Update in Canvas leaves them alone`,
    );

  const assignment: LocalAssignment = {
    name: canvasAssignment.name,
    description: canvasHtmlToMarkdown(canvasAssignment.description),
    dueAt: dueDateOrFallback(canvasAssignment.due_at, context, warnings),
    lockAt: toMarkdownDate(canvasAssignment.lock_at),
    unlockAt: toMarkdownDate(canvasAssignment.unlock_at),
    localAssignmentGroupName: context.assignmentGroupName ?? "",
    submissionTypes: submissionTypesFromCanvas(
      canvasAssignment.submission_types,
      warnings,
    ),
    allowedFileUploadExtensions: canvasAssignment.allowed_extensions ?? [],
    rubric: canvasRubricToLocal(canvasAssignment, warnings),
    ...(canvasAssignment.submission_types?.includes("external_tool") &&
      canvasAssignment.external_tool_tag_attributes?.url && {
        externalToolUrl: canvasAssignment.external_tool_tag_attributes.url,
      }),
    ...(groupSet && {
      groupSet,
      gradeIndividually:
        canvasAssignment.grade_group_students_individually ?? false,
    }),
  };

  const markdown = assignmentMarkdownSerializer.toMarkdown(assignment);
  assignmentMarkdownParser.parseMarkdown(markdown, assignment.name);
  return { item: assignment, warnings };
}

export function canvasPageToLocal(
  canvasPage: CanvasPage,
  context: ImportContext,
): Converted<LocalCoursePage> {
  const page: LocalCoursePage = {
    name: canvasPage.title,
    text: canvasHtmlToMarkdown(canvasPage.body),
    dueAt: context.fallbackDate,
  };
  localPageMarkdownUtils.parseMarkdown(
    localPageMarkdownUtils.toMarkdown(page),
    page.name,
  );
  return { item: page, warnings: [] };
}

// turndown escapes "[", "]" and "_", which would hide a [blank_1] placeholder
const unescapeBlanks = (markdown: string, blankIds: string[]) =>
  blankIds.reduce(
    (text, id) =>
      text.replaceAll(`\\[${id.replaceAll("_", "\\_")}\\]`, `[${id}]`),
    markdown,
  );

const uniqueBlankIds = (question: CanvasQuizQuestion) => [
  ...new Set(
    (question.answers ?? [])
      .map((a) => a.blank_id)
      .filter((id): id is string => !!id),
  ),
];

export const questionTextMarkdown = (html: string) =>
  canvasHtmlToMarkdown(html, { bulletListMarker: "*" });

const answerMarkdown = (answer: { html?: string; text: string }) =>
  answer.html
    ? questionTextMarkdown(answer.html)
    : (answer.text ?? "").trim();

export class UnsupportedQuestion extends Error {}

/**
 * A multiple dropdowns question's file form lists its prompts as answers;
 * in Canvas each [blank] sits in the text. Each blank must be on its own
 * line, which becomes that dropdown's prompt.
 */
function dropdownQuestion(
  question: CanvasQuizQuestion,
  base: Omit<LocalQuizQuestion, "questionType" | "answers" | "text">,
): LocalQuizQuestion {
  const blankIds = uniqueBlankIds(question);
  const lines = unescapeBlanks(
    questionTextMarkdown(question.question_text),
    blankIds,
  ).split("\n");
  const promptLines = new Set<number>();
  const answers: LocalQuizQuestionAnswer[] = blankIds.flatMap((id, group) => {
    const lineIndex = lines.findIndex((l) => l.includes(`[${id}]`));
    if (lineIndex === -1 || promptLines.has(lineIndex))
      throw new UnsupportedQuestion(
        "a dropdown that shares a line with another dropdown",
      );
    promptLines.add(lineIndex);
    const line = lines[lineIndex];
    const atEnd = new RegExp(`\\s*\\[${id}\\][\\s.:]*$`);
    const prompt = (
      atEnd.test(line)
        ? line.replace(atEnd, "")
        : line.replace(`[${id}]`, "___")
    ).trim();
    const options = (question.answers ?? []).filter((a) => a.blank_id === id);
    const correct = options.find((a) => a.weight > 0);
    if (!prompt || !correct)
      throw new UnsupportedQuestion("a dropdown with no prompt or no answer");
    return [
      {
        correct: true,
        text: prompt,
        matchedText: correct.text,
        dropdownGroup: group,
      },
      ...options
        .filter((a) => a !== correct)
        .map((a) => ({
          correct: false,
          text: "",
          matchedText: a.text,
          dropdownGroup: group,
        })),
    ];
  });
  return {
    ...base,
    questionType: QuestionType.MULTIPLE_DROPDOWNS,
    text: lines
      .filter((_, i) => !promptLines.has(i))
      .join("\n")
      .trim(),
    answers,
  };
}

function convertQuestion(question: CanvasQuizQuestion): LocalQuizQuestion {
  const base = {
    points: question.points_possible ?? 0,
    matchDistractors: [] as string[],
    ...(question.correct_comments && {
      correctComments: canvasHtmlToPlainText(question.correct_comments),
    }),
    ...(question.incorrect_comments && {
      incorrectComments: canvasHtmlToPlainText(question.incorrect_comments),
    }),
    ...(question.neutral_comments && {
      neutralComments: canvasHtmlToPlainText(question.neutral_comments),
    }),
  };
  const answers = question.answers ?? [];
  const text = questionTextMarkdown(question.question_text);

  switch (question.question_type) {
    case "multiple_choice_question":
    case "true_false_question":
    case "multiple_answers_question":
      return {
        ...base,
        text,
        questionType:
          question.question_type === "multiple_answers_question"
            ? QuestionType.MULTIPLE_ANSWERS
            : QuestionType.MULTIPLE_CHOICE,
        answers: answers.map((a) => ({
          correct: a.weight > 0,
          text: answerMarkdown(a),
        })),
      };
    case "essay_question":
      return { ...base, text, questionType: QuestionType.ESSAY, answers: [] };
    case "short_answer_question":
      return answers.length === 0
        ? { ...base, text, questionType: QuestionType.SHORT_ANSWER, answers: [] }
        : {
            ...base,
            text,
            questionType: QuestionType.SHORT_ANSWER_WITH_ANSWERS,
            answers: answers.map((a) => ({ correct: true, text: a.text.trim() })),
          };
    case "matching_question":
      return {
        ...base,
        text,
        questionType: QuestionType.MATCHING,
        // a " - " in a left side would split it; the file escapes it
        answers: answers.map((a) => ({
          correct: true,
          text: (a.left ?? a.text ?? "").trim().replaceAll(" - ", " \\- "),
          matchedText: (a.right ?? "").trim(),
        })),
        matchDistractors: (question.matching_answer_incorrect_matches ?? "")
          .split("\n")
          .map((d) => d.trim())
          .filter(Boolean),
      };
    case "numerical_question":
      return {
        ...base,
        text,
        questionType: QuestionType.NUMERICAL,
        answers: answers.map((a): LocalQuizQuestionAnswer => {
          if (a.numerical_answer_type === "range_answer")
            return {
              correct: true,
              text: `= [${a.start}, ${a.end}]`,
              numericalAnswerType: "range_answer",
              numericAnswerRangeMin: Number(a.start),
              numericAnswerRangeMax: Number(a.end),
            };
          const exact = Number(
            a.numerical_answer_type === "precision_answer"
              ? a.approximate
              : a.exact,
          );
          if (Number.isNaN(exact))
            throw new UnsupportedQuestion("a numerical answer with no value");
          const margin =
            a.numerical_answer_type === "precision_answer"
              ? 0
              : Number(a.margin ?? 0);
          return {
            correct: true,
            text: margin > 0 ? `= ${exact} +- ${margin}` : `= ${exact}`,
            numericalAnswerType: "exact_answer",
            numericAnswer: exact,
            ...(margin > 0 && { numericAnswerMargin: margin }),
          };
        }),
      };
    case "fill_in_multiple_blanks_question":
      return {
        ...base,
        text: unescapeBlanks(text, uniqueBlankIds(question)),
        questionType: QuestionType.FILL_IN_MULTIPLE_BLANKS,
        answers: answers.map((a) => ({
          correct: true,
          text: a.text.trim(),
          blankId: a.blank_id,
        })),
      };
    case "multiple_dropdowns_question":
      return dropdownQuestion(question, base);
    default:
      throw new UnsupportedQuestion(
        question.question_type.replace(/_question$/, "").replaceAll("_", " "),
      );
  }
}

export const questionRoundTrips = (question: LocalQuizQuestion) => {
  try {
    const markdown = quizQuestionMarkdownUtils.toMarkdown(question);
    const reparsed = quizQuestionMarkdownUtils.parseMarkdown(markdown, 0);
    return quizQuestionMarkdownUtils.toMarkdown(reparsed) === markdown;
  } catch {
    return false;
  }
};

/**
 * A question the file format can't hold becomes an essay question with its
 * text, so the quiz still imports; the warning says which one to fix.
 */
function questionToLocal(
  question: CanvasQuizQuestion,
  number: number,
  warnings: string[],
): LocalQuizQuestion {
  const essay = (reason: string): LocalQuizQuestion => {
    warnings.push(
      `question ${number} (${reason}) was imported as an essay question; rewrite it in the file`,
    );
    return {
      text: questionTextMarkdown(question.question_text),
      questionType: QuestionType.ESSAY,
      points: question.points_possible ?? 0,
      answers: [],
      matchDistractors: [],
    };
  };
  try {
    const converted = convertQuestion(question);
    if (question.question_type === "numerical_question") {
      if (
        (question.answers ?? []).some(
          (a) => a.numerical_answer_type === "precision_answer",
        )
      )
        warnings.push(
          `question ${number}: a precision answer became an exact answer`,
        );
    }
    if (questionRoundTrips(converted)) return converted;
    return essay("its text or answers read differently as a file");
  } catch (e) {
    if (e instanceof UnsupportedQuestion) return essay(e.message);
    throw e;
  }
}

export function canvasQuizToLocal(
  canvasQuiz: CanvasQuiz,
  canvasQuestions: CanvasQuizQuestion[],
  context: ImportContext,
): Converted<LocalQuiz> {
  const warnings: string[] = [];
  if (canvasQuestions.some((q) => q.quiz_group_id))
    warnings.push(
      "some questions are in question groups, which the file doesn't have; every question is listed",
    );
  const quiz: LocalQuiz = {
    name: canvasQuiz.title,
    description: canvasHtmlToMarkdown(canvasQuiz.description),
    password: canvasQuiz.access_code || undefined,
    dueAt: dueDateOrFallback(canvasQuiz.due_at, context, warnings),
    lockAt: toMarkdownDate(canvasQuiz.lock_at),
    unlockAt: toMarkdownDate(canvasQuiz.unlock_at),
    shuffleAnswers: canvasQuiz.shuffle_answers ?? false,
    showCorrectAnswers: canvasQuiz.show_correct_answers ?? false,
    oneQuestionAtATime: canvasQuiz.one_question_at_a_time ?? false,
    localAssignmentGroupName: context.assignmentGroupName ?? "",
    allowedAttempts: canvasQuiz.allowed_attempts ?? 1,
    ...(canvasQuiz.time_limit ? { timeLimit: canvasQuiz.time_limit } : {}),
    questions: canvasQuestions.map((q, i) => questionToLocal(q, i + 1, warnings)),
  };
  // throws when the description would break the file's settings section
  quizMarkdownUtils.assertCanRoundTrip(quiz);
  return { item: quiz, warnings };
}
