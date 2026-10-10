import { CanvasQuizQuestion } from "@/features/canvas/models/quizzes/canvasQuizQuestionModel";
import {
  getAnswersForCanvas,
  getQuestionTextForCanvas,
  getQuestionTypeForCanvas,
} from "@/features/canvas/services/canvasQuizService";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
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
    case QuestionType.NUMERICAL:
      return sent.map((a) =>
        a.numerical_answer_type === "range_answer"
          ? `[${Number(a.answer_range_start)}, ${Number(a.answer_range_end)}]`
          : `= ${Number(a.exact)}`,
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
    case "numerical_question":
      return answers.map((a) =>
        a.numerical_answer_type === "range_answer"
          ? `[${Number(a.start)}, ${Number(a.end)}]`
          : `= ${Number(a.exact)}`,
      );
    default:
      return answers.map(
        (a) => `${correctMark(a.weight > 0)}${plainText(a.html || a.text)}`,
      );
  }
}

interface Aspect {
  name: string;
  local: string;
  canvas: string;
  same: boolean;
}

function compareQuestion(
  question: LocalQuizQuestion,
  canvasQuestion: CanvasQuizQuestion,
  settings: LocalCourseSettings,
): Aspect[] {
  const localHtml = markdownToHTMLSafe({
    markdownString: getQuestionTextForCanvas(question),
    settings,
  });
  const localType = getQuestionTypeForCanvas(question);
  const localAnswers = localAnswerLines(question, settings);
  const canvasAnswers = canvasAnswerLines(canvasQuestion);
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
      name: "text",
      local: excerpt(plainText(localHtml), 200),
      canvas: excerpt(plainText(canvasQuestion.question_text), 200),
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

/**
 * One row per question, in quiz order: type, points, text, answers and
 * feedback against what Canvas has. Canvas lists a quiz's questions in quiz
 * order, so the nth question is compared with the nth.
 */
export function checkQuizQuestions(
  questions: LocalQuizQuestion[],
  canvasQuestions: CanvasQuizQuestion[],
  settings: LocalCourseSettings,
): SyncField[] {
  const count = Math.max(questions.length, canvasQuestions.length);
  return Array.from({ length: count }, (_, i): SyncField => {
    const question = questions[i];
    const canvasQuestion = canvasQuestions[i];
    const number = i + 1;
    const base = {
      key: `question${number}`,
      section: "questions" as const,
    };

    if (!canvasQuestion)
      return {
        ...base,
        label: `Question ${number}`,
        local: excerpt(plainText(markdownToHTMLSafe({ markdownString: question.text, settings }))),
        canvas: UNSET,
        same: false,
        message: `question ${number} not in canvas`,
      };
    if (!question)
      return {
        ...base,
        label: `Question ${number}`,
        local: UNSET,
        canvas: excerpt(plainText(canvasQuestion.question_text)),
        same: false,
        message: `question ${number} is only in canvas`,
      };

    const aspects = compareQuestion(question, canvasQuestion, settings);
    const different = aspects.filter((a) => !a.same);
    const label = `Question ${number} · ${typeLabel(getQuestionTypeForCanvas(question))}`;
    if (different.length === 0) {
      const text = aspects.find((a) => a.name === "text")!.local;
      return { ...base, label, local: text, canvas: text, same: true, message: "" };
    }
    return {
      ...base,
      label,
      local: different.map((a) => `${a.name}: ${a.local}`).join("\n"),
      canvas: different.map((a) => `${a.name}: ${a.canvas}`).join("\n"),
      same: false,
      message: `question ${number} ${different.map((a) => a.name).join(", ")} different`,
    };
  });
}
