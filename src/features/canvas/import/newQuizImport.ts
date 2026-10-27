import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import {
  CanvasNewQuiz,
  CanvasNewQuizItem,
} from "@/features/canvas/models/quizzes/canvasNewQuizModel";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import {
  LocalQuizQuestion,
  QuestionType,
} from "@/features/local/quizzes/models/localQuizQuestion";
import { LocalQuizQuestionAnswer } from "@/features/local/quizzes/models/localQuizQuestionAnswer";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";
import { canvasHtmlToMarkdown, canvasHtmlToPlainText } from "./canvasHtmlToMarkdown";
import {
  Converted,
  dueDateOrFallback,
  ImportContext,
  questionRoundTrips,
  questionTextMarkdown,
  toMarkdownDate,
  UnsupportedQuestion,
} from "./canvasImport";

// A New Quizzes quiz imports as a classic quiz file. Questions the file can
// hold become questions; the rest become HTML comments at the end of the
// quiz's Description, which never reach Canvas (comments are stripped when
// the description is rendered) and survive every rewrite of the file.

const typeNames: Record<string, string> = {
  choice: "multiple choice",
  "true-false": "true/false",
  "multi-answer": "multiple answer",
  essay: "essay",
  matching: "matching",
  numeric: "numeric",
  "rich-fill-blank": "fill in the blank",
  categorization: "categorization",
  ordering: "ordering",
  "hot-spot": "hot spot",
  formula: "formula",
  "file-upload": "file upload",
};

type Choice = { id: string; position?: number; item_body?: string };

const byPosition = (choices: Choice[]) =>
  [...choices].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

const choicesOf = (item: CanvasNewQuizItem) => {
  const choices = item.entry?.interaction_data?.choices;
  if (!Array.isArray(choices) || choices.length === 0)
    throw new UnsupportedQuestion("its choices couldn't be read");
  return byPosition(choices as Choice[]);
};

const plain = (html: string | undefined) => canvasHtmlToPlainText(html).trim();

const feedbackOf = (item: CanvasNewQuizItem) => {
  const feedback = item.entry?.feedback ?? {};
  return {
    ...(feedback.correct && { correctComments: plain(feedback.correct) }),
    ...(feedback.incorrect && { incorrectComments: plain(feedback.incorrect) }),
    ...(feedback.neutral && { neutralComments: plain(feedback.neutral) }),
  };
};

type NumericAnswer = {
  type?: string;
  value?: string | number;
  start?: string | number;
  end?: string | number;
};

function numericAnswer(answer: NumericAnswer, warnings: string[], number: number): LocalQuizQuestionAnswer {
  if (answer.type === "withinARange") {
    const min = Number(answer.start);
    const max = Number(answer.end);
    if (Number.isNaN(min) || Number.isNaN(max))
      throw new UnsupportedQuestion("a range answer with no numbers");
    return {
      correct: true,
      text: `= [${min}, ${max}]`,
      numericalAnswerType: "range_answer",
      numericAnswerRangeMin: min,
      numericAnswerRangeMax: max,
    };
  }
  if (answer.type === "marginOfError")
    warnings.push(`question ${number}: the file has no margin of error, so the answer must be exact`);
  else if (answer.type === "preciseResponse")
    warnings.push(`question ${number}: a precision answer became an exact answer`);
  else if (answer.type !== "exactResponse")
    throw new UnsupportedQuestion(`a ${answer.type ?? "numeric"} answer`);
  const exact = Number(answer.value);
  if (Number.isNaN(exact)) throw new UnsupportedQuestion("a numeric answer with no value");
  return {
    correct: true,
    text: `= ${exact}`,
    numericalAnswerType: "exact_answer",
    numericAnswer: exact,
  };
}

function convertItem(item: CanvasNewQuizItem, warnings: string[], number: number): LocalQuizQuestion {
  const entry = item.entry ?? {};
  const slug = entry.interaction_type_slug ?? "";
  const data = entry.interaction_data ?? {};
  const correct = entry.scoring_data?.value;
  const base = {
    points: item.points_possible ?? 0,
    matchDistractors: [] as string[],
    ...feedbackOf(item),
  };
  const text = questionTextMarkdown(entry.item_body ?? "");

  switch (slug) {
    case "choice":
      return {
        ...base,
        text,
        questionType: QuestionType.MULTIPLE_CHOICE,
        answers: choicesOf(item).map((c) => ({
          correct: c.id === correct,
          text: questionTextMarkdown(c.item_body ?? ""),
        })),
      };
    case "multi-answer": {
      const correctIds = Array.isArray(correct) ? correct : [];
      return {
        ...base,
        text,
        questionType: QuestionType.MULTIPLE_ANSWERS,
        answers: choicesOf(item).map((c) => ({
          correct: correctIds.includes(c.id),
          text: questionTextMarkdown(c.item_body ?? ""),
        })),
      };
    }
    case "true-false":
      return {
        ...base,
        text,
        questionType: QuestionType.MULTIPLE_CHOICE,
        answers: [
          { correct: correct === true, text: String(data.true_choice ?? "True") },
          { correct: correct === false, text: String(data.false_choice ?? "False") },
        ],
      };
    case "essay":
      return { ...base, text, questionType: QuestionType.ESSAY, answers: [] };
    case "file-upload":
      return { ...base, text, questionType: QuestionType.FILE_UPLOAD, answers: [] };
    case "matching": {
      const prompts = data.questions as { id: string; item_body?: string }[] | undefined;
      const matches = correct as Record<string, string> | undefined;
      if (!Array.isArray(prompts) || !matches)
        throw new UnsupportedQuestion("its pairs couldn't be read");
      const used = new Set(Object.values(matches));
      const allAnswers = Array.isArray(data.answers) ? (data.answers as string[]) : [];
      return {
        ...base,
        text,
        questionType: QuestionType.MATCHING,
        // a " - " in a left side would split it; the file escapes it
        answers: prompts.map((p) => ({
          correct: true,
          text: plain(p.item_body).replaceAll(" - ", " \\- "),
          matchedText: String(matches[p.id] ?? "").trim(),
        })),
        matchDistractors: allAnswers.map((a) => a.trim()).filter((a) => a && !used.has(a)),
      };
    }
    case "numeric": {
      const answers = Array.isArray(correct) ? (correct as NumericAnswer[]) : [];
      if (answers.length === 0) throw new UnsupportedQuestion("no numeric answers");
      return {
        ...base,
        text,
        questionType: QuestionType.NUMERICAL,
        answers: answers.map((a) => numericAnswer(a, warnings, number)),
      };
    }
    default:
      throw new UnsupportedQuestion(typeNames[slug] ?? (slug || item.entry_type));
  }
}

// keeps a note inside one HTML comment and out of the quiz's "---" split
const commentSafe = (text: string) =>
  text.replaceAll("-->", "->").replaceAll("---", "—").replaceAll("<!--", "<!");

/** Choice ids in the answer key, read as their text. */
function answerKey(item: CanvasNewQuizItem): string {
  const value = item.entry?.scoring_data?.value;
  if (value === undefined || value === "" || value === null) return "";
  const text = new Map<string, string>();
  const collect = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === "object") {
      const { id, item_body } = node as { id?: unknown; item_body?: unknown };
      if (typeof id === "string" && typeof item_body === "string") text.set(id, plain(item_body));
      Object.values(node).forEach(collect);
    }
  };
  collect(item.entry?.interaction_data);
  const json = JSON.stringify(value, (_, v) => (typeof v === "string" && text.has(v) ? text.get(v) : v));
  return json.length > 600 ? json.slice(0, 600) + "…" : json;
}

/** The options a question offers: every choice-like text in its interaction data. */
function optionTexts(item: CanvasNewQuizItem): string[] {
  const texts: string[] = [];
  const collect = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === "object") {
      const { item_body } = node as { item_body?: unknown };
      if (typeof item_body === "string") texts.push(plain(item_body));
      Object.values(node).forEach(collect);
    } else if (typeof node === "string" && node.trim() && !/^[0-9a-f-]{20,}$/i.test(node))
      texts.push(node.trim());
  };
  const data = item.entry?.interaction_data ?? {};
  // text the student picks from, not settings like word_count
  for (const key of ["choices", "answers", "questions", "categories", "distractors", "blanks"])
    collect(data[key]);
  return texts.filter(Boolean);
}

function notImportedComment(
  item: CanvasNewQuizItem,
  reason: string,
  number: number,
  importedSoFar: number,
): string {
  const where =
    importedSoFar === 0
      ? "it came before the first question here"
      : `it came after question ${importedSoFar} here`;
  const prompt = plain(item.entry?.item_body ?? item.entry?.body ?? item.entry?.title ?? "");
  const lines = [
    `New Quizzes question ${number} was not imported (${reason}, ${item.points_possible ?? 0} pts); ${where}.`,
    ...(prompt ? [`Prompt: ${prompt}`] : []),
    ...optionTexts(item).map((t) => `- ${t}`),
    ...(answerKey(item) ? [`Answer key: ${answerKey(item)}`] : []),
  ];
  return `<!--\n${commentSafe(lines.join("\n"))}\n-->`;
}

function quizSettings(newQuiz: CanvasNewQuiz, warnings: string[]) {
  const settings = newQuiz.quiz_settings ?? {};
  const attempts = settings.multiple_attempts ?? {};
  const results = settings.result_view_settings ?? {};
  const seconds = settings.has_time_limit ? (settings.session_time_limit_in_seconds ?? 0) : 0;
  if (seconds % 60 !== 0)
    warnings.push(`the ${seconds} second time limit was rounded to whole minutes`);
  if (settings.shuffle_questions)
    warnings.push("Canvas shuffles the questions, which the file doesn't do");
  return {
    password: (settings.require_student_access_code && settings.student_access_code) || undefined,
    shuffleAnswers: settings.shuffle_answers ?? false,
    oneQuestionAtATime: settings.one_at_a_time_type === "question",
    showCorrectAnswers: results.result_view_restricted
      ? (results.display_item_correct_answer ?? false)
      : true,
    allowedAttempts: !attempts.multiple_attempts_enabled
      ? 1
      : attempts.attempt_limit && attempts.max_attempts
        ? attempts.max_attempts
        : -1,
    ...(seconds > 0 && { timeLimit: Math.max(1, Math.round(seconds / 60)) }),
  };
}

export function newQuizToLocal(
  canvasAssignment: CanvasAssignment,
  newQuiz: CanvasNewQuiz,
  items: CanvasNewQuizItem[],
  context: ImportContext,
): Converted<LocalQuiz> {
  const warnings: string[] = [];
  const questions: LocalQuizQuestion[] = [];
  const comments: string[] = [];
  items.forEach((item, i) => {
    const number = i + 1;
    const skip = (reason: string) => {
      comments.push(notImportedComment(item, reason, number, questions.length));
      warnings.push(`question ${number} (${reason}) wasn't imported; it's described in a comment in the Description`);
    };
    if (item.entry_type !== "Item")
      return skip(item.entry_type === "Stimulus" ? "a stimulus passage" : "pulled from an item bank");
    try {
      const question = convertItem(item, warnings, number);
      if (questionRoundTrips(question)) questions.push(question);
      else skip("its text or answers read differently as a file");
    } catch (e) {
      if (e instanceof UnsupportedQuestion) skip(e.message);
      else if (e instanceof TypeError) skip("its answers couldn't be read");
      else throw e;
    }
  });

  const filePoints = questions.reduce((sum, q) => sum + q.points, 0);
  const canvasPoints = newQuiz.points_possible ?? canvasAssignment.points_possible;
  if (canvasPoints !== undefined && canvasPoints !== null && canvasPoints !== filePoints)
    warnings.push(`the questions here are worth ${filePoints} points; the New Quiz was worth ${canvasPoints}`);

  const description = [canvasHtmlToMarkdown(newQuiz.instructions ?? ""), ...comments]
    .filter((part) => part.trim())
    .join("\n\n");
  const quiz: LocalQuiz = {
    name: canvasAssignment.name,
    description,
    dueAt: dueDateOrFallback(newQuiz.due_at ?? canvasAssignment.due_at, context, warnings),
    lockAt: toMarkdownDate(newQuiz.lock_at ?? canvasAssignment.lock_at),
    unlockAt: toMarkdownDate(newQuiz.unlock_at ?? canvasAssignment.unlock_at),
    localAssignmentGroupName: context.assignmentGroupName ?? "",
    ...quizSettings(newQuiz, warnings),
    questions,
  };
  // throws when the description would break the file's settings section
  quizMarkdownUtils.assertCanRoundTrip(quiz);
  return { item: quiz, warnings };
}
