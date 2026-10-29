import { CanvasQuizQuestion } from "@/features/canvas/models/quizzes/canvasQuizQuestionModel";
import {
  getAnswersForCanvas,
  getQuestionTextForCanvas,
  getQuestionTypeForCanvas,
} from "@/features/canvas/services/canvasQuizService";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { quizPointTotal } from "@/features/local/quizzes/models/quizPoints";
import {
  LocalQuizQuestion,
  QuestionType,
} from "@/features/local/quizzes/models/localQuizQuestion";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { removeHtmlDetails } from "@/services/utils/htmlIsCloseEnough";
import type { SyncField } from "./getAssignmentSyncStatus";

const UNSET = "—";

/** Visible text of some HTML: no tags, theme scripts or entities, single spaces. */
export const plainText = (html: string | null | undefined) =>
  (html ?? "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim();

const excerpt = (text: string, length = 70) =>
  text.length > length ? text.slice(0, length - 1) + "…" : text;

const typeLabel = (canvasType: string) =>
  canvasType.replace(/_question$/, "").replaceAll("_", " ");

const correctMark = (correct: boolean) => (correct ? "✓ " : "");

/**
 * Each answer as one comparable line, built the same way for the file (from
 * what Update in Canvas would send) and for Canvas (from what it returns).
 */
const exactLine = (exact: number, margin: number) =>
  margin ? `= ${exact} +- ${margin}` : `= ${exact}`;

function localAnswerLines(
  question: LocalQuizQuestion,
  settings: LocalCourseSettings,
): string[] {
  const sent = getAnswersForCanvas(question, settings) as Record<
    string,
    unknown
  >[];
  switch (question.questionType) {
    case QuestionType.ESSAY:
    case QuestionType.FILE_UPLOAD:
      return [];
    case QuestionType.MATCHING:
      return [
        ...sent.map(
          (a) =>
            `${plainText(String(a.answer_match_left ?? ""))} → ${plainText(String(a.answer_match_right ?? ""))}`,
        ),
        ...question.matchDistractors.map((d) => `distractor: ${plainText(d)}`),
      ];
    case QuestionType.FILL_IN_MULTIPLE_BLANKS:
    case QuestionType.MULTIPLE_DROPDOWNS:
      return sent.map(
        (a) =>
          `[${a.blank_id}] ${correctMark(Number(a.answer_weight) > 0)}${plainText(String(a.answer_text ?? ""))}`,
      );
    // Canvas keeps only the text of a short answer, and markdown would read
    // an answer like "+" as a list or "a*b*c" as emphasis
    case QuestionType.SHORT_ANSWER_WITH_ANSWERS:
      return sent.map(
        (a) =>
          `${correctMark(Number(a.answer_weight) > 0)}${String(a.answer_text ?? "")}`,
      );
    case QuestionType.NUMERICAL:
      return sent.map((a) =>
        a.numerical_answer_type === "range_answer"
          ? `[${Number(a.answer_range_start)}, ${Number(a.answer_range_end)}]`
          : exactLine(Number(a.answer_exact), Number(a.answer_error_margin)),
      );
    default:
      return sent.map(
        (a) =>
          `${correctMark(Number(a.answer_weight) > 0)}${plainText(String(a.answer_html ?? a.answer_text ?? ""))}`,
      );
  }
}

function canvasAnswerLines(question: CanvasQuizQuestion): string[] {
  const answers = question.answers ?? [];
  switch (question.question_type) {
    case "essay_question":
    case "file_upload_question":
      return [];
    case "matching_question":
      return [
        ...answers.map(
          (a) => `${plainText(a.left ?? a.text)} → ${plainText(a.right)}`,
        ),
        ...(question.matching_answer_incorrect_matches ?? "")
          .split("\n")
          .map((d) => d.trim())
          .filter(Boolean)
          .map((d) => `distractor: ${plainText(d)}`),
      ];
    case "fill_in_multiple_blanks_question":
    case "multiple_dropdowns_question":
      return answers.map(
        (a) =>
          `[${a.blank_id}] ${correctMark(a.weight > 0)}${plainText(a.text)}`,
      );
    case "short_answer_question":
      return answers.map((a) => `${correctMark(a.weight > 0)}${a.text}`);
    case "numerical_question":
      return answers.map((a) =>
        a.numerical_answer_type === "range_answer"
          ? `[${Number(a.start)}, ${Number(a.end)}]`
          : exactLine(Number(a.exact), Number(a.margin)),
      );
    default:
      return answers.map(
        (a) => `${correctMark(a.weight > 0)}${plainText(a.html || a.text)}`,
      );
  }
}

/** `lines` lined up with `order`; lines not in it go last. */
const inOrderOf = (order: string[], lines: string[]) =>
  [...lines].sort(
    (a, b) => (order.indexOf(a) >>> 0) - (order.indexOf(b) >>> 0),
  );

interface Aspect {
  name: string;
  local: string;
  canvas: string;
  same: boolean;
}

const groupLabel = (group?: { name: string; pick: number }) =>
  group ? `${group.name}, pick ${group.pick}` : UNSET;

function compareQuestion(
  question: LocalQuizQuestion,
  canvasQuestion: CanvasQuizQuestion,
  settings: LocalCourseSettings,
  ignoreAnswerOrder: boolean,
): Aspect[] {
  const localHtml = markdownToHTMLSafe({
    markdownString: getQuestionTextForCanvas(question),
    settings,
  });
  const localType = getQuestionTypeForCanvas(question);
  const localAnswers = localAnswerLines(question, settings);
  const canvasAnswers = ignoreAnswerOrder
    ? inOrderOf(localAnswers, canvasAnswerLines(canvasQuestion))
    : canvasAnswerLines(canvasQuestion);
  const feedback = (correct?: string, incorrect?: string, neutral?: string) =>
    [
      correct && `+ ${plainText(correct)}`,
      incorrect && `- ${plainText(incorrect)}`,
      neutral && `... ${plainText(neutral)}`,
    ]
      .filter(Boolean)
      .join("\n");
  const localFeedback = feedback(
    question.correctComments,
    question.incorrectComments,
    question.neutralComments,
  );
  const canvasFeedback = feedback(
    canvasQuestion.correct_comments,
    canvasQuestion.incorrect_comments,
    canvasQuestion.neutral_comments,
  );
  const localGroup = groupLabel(
    question.group && {
      name: question.group.name,
      pick: question.group.pickCount,
    },
  );
  const canvasGroup = groupLabel(
    canvasQuestion.quiz_group && {
      name: canvasQuestion.quiz_group.name,
      pick: canvasQuestion.quiz_group.pick_count,
    },
  );

  return [
    {
      name: "type",
      local: typeLabel(localType),
      canvas: typeLabel(canvasQuestion.question_type),
      same: localType === canvasQuestion.question_type,
    },
    {
      name: "points",
      local: String(question.points),
      canvas: String(canvasQuestion.points_possible ?? UNSET),
      same: question.points === canvasQuestion.points_possible,
    },
    {
      name: "group",
      local: localGroup,
      canvas: canvasGroup,
      same: localGroup === canvasGroup,
    },
    {
      name: "text",
      local: plainText(localHtml),
      canvas: plainText(canvasQuestion.question_text),
      same:
        removeHtmlDetails(localHtml) ===
        removeHtmlDetails(canvasQuestion.question_text ?? ""),
    },
    {
      name: "answers",
      local: localAnswers.join("\n") || UNSET,
      canvas: canvasAnswers.join("\n") || UNSET,
      same: localAnswers.join("\n") === canvasAnswers.join("\n"),
    },
    {
      name: "feedback",
      local: localFeedback || UNSET,
      canvas: canvasFeedback || UNSET,
      same: localFeedback === canvasFeedback,
    },
  ];
}

// ---------------------------------------------------------------------------
// Lining the file's questions up with Canvas's
//
// Comparing the nth question with the nth breaks as soon as one is deleted or
// inserted: every question after it is reported as changed. Instead the two
// lists are aligned the way a text diff aligns lines, matching questions by
// content (text first, answers second), so a question deleted from the file
// shows up as one "only in Canvas" row and the rest still line up.
// ---------------------------------------------------------------------------

/** How alike two questions must be to count as the same question edited. */
const SAME_QUESTION = 0.5;

const words = (text: string) =>
  text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Dice coefficient over word multisets: 1 for the same words, 0 for none shared. */
function wordSimilarity(a: string, b: string) {
  if (a === b) return 1;
  const aw = words(a);
  const bw = words(b);
  if (aw.length === 0 || bw.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const w of aw) counts.set(w, (counts.get(w) ?? 0) + 1);
  let shared = 0;
  for (const w of bw) {
    const n = counts.get(w) ?? 0;
    if (n > 0) {
      shared++;
      counts.set(w, n - 1);
    }
  }
  return (2 * shared) / (aw.length + bw.length);
}

interface QuestionSignature {
  text: string;
  answers: string;
}

function questionSimilarity(a: QuestionSignature, b: QuestionSignature) {
  // text decides; answers break ties between questions that share a prompt
  // ("Match the term to its definition.")
  return (
    0.75 * wordSimilarity(a.text, b.text) +
    0.25 * wordSimilarity(a.answers, b.answers)
  );
}

type AlignedRow =
  | { local: number; canvas: number; moved?: boolean }
  | { local: number; canvas?: undefined }
  | { local?: undefined; canvas: number };

/**
 * Pairs file and Canvas questions in order, maximizing how alike the pairs
 * are. Questions that match nothing are left unpaired, except that an
 * unpaired file question and an unpaired Canvas question at the same spot are
 * paired as one rewritten question. Finally a question that only moved (in
 * both lists, but in a different order) is paired back up and marked moved.
 */
export function alignQuestions(
  local: QuestionSignature[],
  canvas: QuestionSignature[],
): AlignedRow[] {
  const n = local.length;
  const m = canvas.length;
  const similarity = local.map((l) => canvas.map((c) => questionSimilarity(l, c)));
  // a real match is worth far more than a rewritten-in-place pair, which is
  // only worth taking when it costs no real match
  const pairScore = (i: number, j: number) =>
    similarity[i][j] >= SAME_QUESTION ? 1 + similarity[i][j] : 0.001;

  const best = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      best[i][j] = Math.max(
        best[i - 1][j],
        best[i][j - 1],
        best[i - 1][j - 1] + pairScore(i - 1, j - 1),
      );

  const rows: AlignedRow[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      best[i][j] === best[i - 1][j - 1] + pairScore(i - 1, j - 1)
    ) {
      rows.push({ local: i - 1, canvas: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || best[i][j] === best[i][j - 1])) {
      rows.push({ canvas: j - 1 });
      j--;
    } else {
      rows.push({ local: i - 1 });
      i--;
    }
  }
  rows.reverse();

  // a question that moved is left unpaired on both sides; pair it back up
  const fileOnly = rows.filter((r) => r.canvas === undefined);
  const canvasOnly = rows.filter((r) => r.local === undefined);
  const moved = new Map<AlignedRow, number>();
  const taken = new Set<AlignedRow>();
  for (const f of fileOnly) {
    let match: AlignedRow | undefined;
    let matchSimilarity = SAME_QUESTION;
    for (const c of canvasOnly) {
      if (taken.has(c)) continue;
      const s = similarity[f.local!][c.canvas!];
      if (s >= matchSimilarity) {
        match = c;
        matchSimilarity = s;
      }
    }
    if (match) {
      moved.set(f, match.canvas!);
      taken.add(match);
    }
  }
  return rows
    .filter((r) => !taken.has(r))
    .map((r) =>
      moved.has(r) ? { local: r.local!, canvas: moved.get(r)!, moved: true } : r,
    );
}

/**
 * One row per question: type, points, text, answers and feedback against what
 * Canvas has. Rows follow the file's order, with a question that is only in
 * Canvas (deleted from the file) shown where it sits in Canvas.
 */
export function checkQuizQuestions(
  questions: LocalQuizQuestion[],
  canvasQuestions: CanvasQuizQuestion[],
  settings: LocalCourseSettings,
  /**
   * For a student's attempt, which stores its own shuffle of the answers and
   * only the questions it was picked from each group.
   */
  { ignoreAnswerOrder = false, isAttempt = false } = {},
): SyncField[] {
  return compareQuestions(questions, canvasQuestions, settings, {
    ignoreAnswerOrder,
    isAttempt,
  }).map(({ field }) => field);
}

/**
 * What Update in Canvas has to do, in file order: a row with both sides pairs
 * a file question with its Canvas question (kept when `same`, else
 * replaced), `local` alone is a question to add, `canvas` alone one to
 * delete. `same` ignores position, which a reorder fixes without touching
 * the question.
 */
export type QuestionPlanRow = {
  local?: number;
  canvas?: number;
  same: boolean;
  moved: boolean;
};

export function planQuestionUpdates(
  questions: LocalQuizQuestion[],
  canvasQuestions: CanvasQuizQuestion[],
  settings: LocalCourseSettings,
): QuestionPlanRow[] {
  // a quiz with question groups has all its questions replaced
  if (questions.some((q) => q.group) || canvasQuestions.some((q) => q.quiz_group_id))
    return [
      ...canvasQuestions.map((_, canvas) => ({ canvas, same: false, moved: false })),
      ...questions.map((_, local) => ({ local, same: false, moved: false })),
    ];
  return compareQuestions(questions, canvasQuestions, settings).map(
    ({ row, sameIgnoringPosition }) => ({
      local: row.local,
      canvas: row.canvas,
      same: sameIgnoringPosition,
      moved: "moved" in row && row.moved === true,
    }),
  );
}

/** What a plan does, in words: "question 3 replaced, question 7 added; 18 left alone". */
export function describeQuestionPlan(plan: QuestionPlanRow[]) {
  const paired = plan.filter((r) => r.local !== undefined && r.canvas !== undefined);
  const added = plan.filter((r) => r.canvas === undefined).length;
  if (paired.length === 0 && added > 0 && added < plan.length)
    return `all ${added} questions replaced`;
  const named = (rows: QuestionPlanRow[], what: string, canvas = false) => {
    const numbers = rows.map((r) => (canvas ? r.canvas! : r.local!) + 1);
    if (numbers.length === 0) return "";
    const list =
      numbers.length === 1
        ? `${numbers[0]}`
        : `${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)}`;
    const noun = numbers.length === 1 ? "question" : "questions";
    return `${canvas ? `Canvas ${noun}` : noun} ${list} ${what}`;
  };
  const changes = [
    named(paired.filter((r) => !r.same), "replaced"),
    named(plan.filter((r) => r.canvas === undefined), "added"),
    named(plan.filter((r) => r.local === undefined), "removed", true),
    named(paired.filter((r) => r.same && r.moved), "moved"),
  ].filter(Boolean);
  if (changes.length === 0) return "";
  const untouched = paired.filter((r) => r.same && !r.moved).length;
  return `${changes.join(", ")}; ${untouched} left alone`;
}

function compareQuestions(
  questions: LocalQuizQuestion[],
  canvasQuestions: CanvasQuizQuestion[],
  settings: LocalCourseSettings,
  { ignoreAnswerOrder = false, isAttempt = false } = {},
): { row: AlignedRow; field: SyncField; sameIgnoringPosition: boolean }[] {
  const localHtml = questions.map((question) =>
    markdownToHTMLSafe({
      markdownString: getQuestionTextForCanvas(question),
      settings,
    }),
  );
  const rows = alignQuestions(
    questions.map((question, i) => ({
      text: plainText(localHtml[i]),
      answers: localAnswerLines(question, settings).join("\n"),
    })),
    canvasQuestions.map((question) => ({
      text: plainText(question.question_text),
      answers: canvasAnswerLines(question).join("\n"),
    })),
  );

  return rows.map((row) => {
    const { field, sameIgnoringPosition = field.same } = compareRow(row);
    return { row, field, sameIgnoringPosition };
  });

  function compareRow(row: AlignedRow): {
    field: SyncField;
    sameIgnoringPosition?: boolean;
  } {
    const base = {
      key: `question:${row.local ?? "-"}:${row.canvas ?? "-"}`,
      section: "questions" as const,
    };

    if (row.canvas === undefined) {
      const number = row.local + 1;
      const notPicked = isAttempt && questions[row.local].group;
      if (notPicked)
        return {
          field: {
            ...base,
            label: `Question ${number}`,
            local: excerpt(plainText(localHtml[row.local])),
            canvas: `not picked from ${questions[row.local].group!.name}`,
            same: true,
            message: "",
          },
        };
      return {
        field: {
          ...base,
          label: `Question ${number}`,
          local: excerpt(plainText(localHtml[row.local])),
          canvas: UNSET,
          same: false,
          message: `question ${number} not in canvas`,
        },
      };
    }
    if (row.local === undefined) {
      const number = row.canvas + 1;
      return {
        field: {
          ...base,
          label: `Canvas question ${number}`,
          local: UNSET,
          canvas: excerpt(plainText(canvasQuestions[row.canvas].question_text)),
          same: false,
          message: `canvas question ${number} is not in the file`,
        },
      };
    }

    const question = questions[row.local];
    const number = row.local + 1;
    const aspects = compareQuestion(
      question,
      canvasQuestions[row.canvas],
      settings,
      ignoreAnswerOrder,
    );
    // an attempt's questions don't say which group they came from
    if (isAttempt) {
      const group = aspects.find((a) => a.name === "group")!;
      group.canvas = group.local;
      group.same = true;
    }
    if ("moved" in row && row.moved)
      aspects.unshift({
        name: "position",
        local: String(number),
        canvas: String(row.canvas + 1),
        same: false,
      });
    const different = aspects.filter((a) => !a.same);
    const label = `Question ${number} · ${typeLabel(getQuestionTypeForCanvas(question))}`;
    return {
      field: {
        ...base,
        label,
        local: wholeQuestion(aspects, "local"),
        canvas: wholeQuestion(aspects, "canvas"),
        same: different.length === 0,
        message:
          different.length === 0
            ? ""
            : `question ${number} ${different.map((a) => a.name).join(", ")} different`,
      },
      sameIgnoringPosition: different.every((a) => a.name === "position"),
    };
  }
}

/**
 * The whole question, one side of it: type and points, text, answers and
 * feedback, with "≠ " before the lines of each part that differs.
 */
function wholeQuestion(aspects: Aspect[], side: "local" | "canvas") {
  const part = (name: string) => aspects.find((a) => a.name === name)!;
  const lines = (aspect: Aspect, value = aspect[side]) =>
    value === UNSET
      ? []
      : value.split("\n").map((line) => (aspect.same ? line : `≠ ${line}`));
  const type = part("type");
  const points = part("points");
  const header = `type: ${type[side]} · points: ${points[side]}`;
  const position = aspects.find((a) => a.name === "position");
  const group = part("group");
  const showGroup = group.local !== UNSET || group.canvas !== UNSET;
  return [
    ...(position ? [`≠ position: ${position[side]}`] : []),
    type.same && points.same ? header : `≠ ${header}`,
    ...(showGroup ? [`${group.same ? "" : "≠ "}group: ${group[side]}`] : []),
    ...lines(part("text")),
    ...lines(part("answers")),
    ...lines(part("feedback")),
  ].join("\n");
}

/**
 * Why updating would be wrong for students who already started, or
 * undefined: their scores are out of the total they were given, so changing
 * it needs a regrade, which the API can't do.
 */
export function pointTotalChangeError(
  questions: LocalQuizQuestion[],
  studentsGot: CanvasQuizQuestion[],
): string | undefined {
  const fileTotal = quizPointTotal(questions);
  const studentsTotal = studentsGot.reduce(
    (sum, q) => sum + (q.points_possible ?? 0),
    0,
  );
  if (fileTotal === studentsTotal) return undefined;
  return `Students who started were scored out of ${studentsTotal} points, and the file's questions total ${fileTotal}. Changing the total needs a regrade in Canvas, so the quiz was not updated.`;
}
