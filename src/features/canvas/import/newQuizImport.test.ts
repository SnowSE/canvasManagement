import { describe, it, expect } from "vitest";
import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import {
  CanvasNewQuiz,
  CanvasNewQuizItem,
} from "@/features/canvas/models/quizzes/canvasNewQuizModel";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { findImportCandidates } from "./canvasImport";
import { newQuizToLocal } from "./newQuizImport";

const context = { fallbackDate: "08/26/2026 23:59:00", assignmentGroupName: "Quizzes" };

const assignment = {
  id: 501,
  name: "Reading Check 3",
  points_possible: 9,
  is_quiz_lti_assignment: true,
  submission_types: ["external_tool"],
  published: true,
} as CanvasAssignment;

const newQuiz: CanvasNewQuiz = {
  id: "501",
  title: "Reading Check 3",
  instructions: "<p>Answer from the reading.</p>",
  points_possible: 9,
  due_at: "2026-09-15T17:00:00Z",
  quiz_settings: {
    shuffle_answers: true,
    one_at_a_time_type: "none",
    has_time_limit: true,
    session_time_limit_in_seconds: 600,
    multiple_attempts: { multiple_attempts_enabled: true, attempt_limit: true, max_attempts: 2 },
  },
};

let position = 0;
const item = (
  slug: string,
  points: number,
  body: string,
  interaction_data: Record<string, unknown>,
  value: unknown,
): CanvasNewQuizItem => ({
  id: `item-${++position}`,
  position,
  points_possible: points,
  entry_type: "Item",
  entry: {
    item_body: `<p>${body}</p>`,
    interaction_type_slug: slug,
    interaction_data,
    scoring_data: { value },
  },
});

const items: CanvasNewQuizItem[] = [
  item(
    "choice",
    1,
    "Pick the replica.",
    {
      choices: [
        { id: "c2", position: 2, item_body: "<p>Leader</p>" },
        { id: "c1", position: 1, item_body: "<p>Follower</p>" },
      ],
    },
    "c1",
  ),
  item("true-false", 1, "Queues buffer load.", { true_choice: "True", false_choice: "False" }, true),
  item(
    "ordering",
    2,
    "Order the steps.",
    {
      choices: {
        o1: { id: "o1", item_body: "<p>Prepare</p>" },
        o2: { id: "o2", item_body: "<p>Commit</p>" },
      },
    },
    ["o1", "o2"],
  ),
  item(
    "multi-answer",
    2,
    "Which are brokers?",
    {
      choices: [
        { id: "m1", position: 1, item_body: "<p>RabbitMQ</p>" },
        { id: "m2", position: 2, item_body: "<p>Postgres</p>" },
        { id: "m3", position: 3, item_body: "<p>Kafka</p>" },
      ],
    },
    ["m1", "m3"],
  ),
  item(
    "matching",
    2,
    "Match each term.",
    {
      questions: [
        { id: "q1", item_body: "<p>Ack</p>" },
        { id: "q2", item_body: "<p>Nack</p>" },
      ],
      answers: ["done", "retry", "ignore"],
    },
    { q1: "done", q2: "retry" },
  ),
  item("numeric", 1, "How many nodes?", {}, [{ type: "exactResponse", value: "3" }]),
  item("essay", 0, "Anything unclear?", { rce: true }, ""),
  item("file-upload", 0, "Upload your diagram.", {}, ""),
];

describe("newQuizToLocal", () => {
  const { item: quiz, warnings } = newQuizToLocal(assignment, newQuiz, items, context);

  it("imports the questions the file can hold, in order", () => {
    expect(quiz.questions.map((q) => q.questionType)).toEqual([
      "multiple_choice",
      "multiple_choice",
      "multiple_answers",
      "matching",
      "numerical",
      "essay",
      "file_upload",
    ]);
    expect(quiz.questions[0].answers).toEqual([
      { correct: true, text: "Follower" },
      { correct: false, text: "Leader" },
    ]);
    expect(quiz.questions[2].answers.map((a) => a.correct)).toEqual([true, false, true]);
    expect(quiz.questions[3].matchDistractors).toEqual(["ignore"]);
    expect(quiz.questions[4].answers[0].numericAnswer).toBe(3);
  });

  it("describes an unsupported question in a comment in the Description", () => {
    expect(quiz.description).toContain("Answer from the reading.");
    expect(quiz.description).toContain("<!--");
    expect(quiz.description).toContain("New Quizzes question 3 was not imported (ordering, 2 pts)");
    expect(quiz.description).toContain("it came after question 2 here");
    expect(quiz.description).toContain("- Prepare");
    expect(quiz.description).toContain('Answer key: ["Prepare","Commit"]');
    expect(warnings.some((w) => w.includes("question 3 (ordering)"))).toBe(true);
    expect(warnings.some((w) => w.includes("worth 7 points"))).toBe(true);
  });

  it("keeps the comment out of what Canvas gets", () => {
    const html = markdownToHTMLSafe({
      markdownString: quiz.description,
      settings: { assets: [] } as unknown as LocalCourseSettings,
    });
    expect(html).toContain("Answer from the reading.");
    expect(html).not.toContain("not imported");
  });

  it("carries the quiz settings over", () => {
    expect(quiz.shuffleAnswers).toBe(true);
    expect(quiz.allowedAttempts).toBe(2);
    expect(quiz.timeLimit).toBe(10);
    expect(quiz.localAssignmentGroupName).toBe("Quizzes");
  });

  it("writes a file that reads back the same", () => {
    const markdown = quizMarkdownUtils.toMarkdown(quiz);
    const reparsed = quizMarkdownUtils.parseMarkdown(markdown, quiz.name);
    expect(quizMarkdownUtils.toMarkdown(reparsed)).toBe(markdown);
    expect(reparsed.questions).toHaveLength(7);
  });

  it("comments out a stimulus and a note that would end the comment early", () => {
    const { item: withStimulus } = newQuizToLocal(
      assignment,
      { ...newQuiz, instructions: null },
      [
        {
          id: "s1",
          position: 1,
          points_possible: 0,
          entry_type: "Stimulus",
          entry: { title: "Passage", body: "<p>Read this --> then --- answer</p>" },
        },
      ],
      context,
    );
    expect(withStimulus.questions).toHaveLength(0);
    expect(withStimulus.description).toContain("a stimulus passage");
    expect(withStimulus.description.match(/-->/g)).toHaveLength(1);
    expect(withStimulus.description).not.toContain("---");
  });
});

describe("findImportCandidates with New Quizzes", () => {
  it("lists a New Quiz with the quizzes, not the assignments", () => {
    const candidates = findImportCandidates({
      canvasAssignments: [assignment],
      canvasQuizzes: [],
      canvasPages: [],
      canvasModules: [],
      localNames: { assignment: new Set(), quiz: new Set(), page: new Set() },
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ type: "quiz", newQuiz: true, canvasId: 501 });
  });
});
