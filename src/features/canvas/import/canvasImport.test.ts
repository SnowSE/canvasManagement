import { describe, expect, it } from "vitest";
import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import { CanvasQuiz } from "@/features/canvas/models/quizzes/canvasQuizModel";
import { CanvasQuizQuestion } from "@/features/canvas/models/quizzes/canvasQuizQuestionModel";
import { CanvasModule } from "@/features/canvas/models/modules/canvasModule";
import { CanvasPage } from "@/features/canvas/models/pages/canvasPageModel";
import { QuestionType } from "@/features/local/quizzes/models/localQuizQuestion";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";
import { assignmentMarkdownSerializer } from "@/features/local/assignments/models/utils/assignmentMarkdownSerializer";
import { assignmentMarkdownParser } from "@/features/local/assignments/models/utils/assignmentMarkdownParser";
import { canvasHtmlToMarkdown } from "./canvasHtmlToMarkdown";
import {
  canvasAssignmentToLocal,
  canvasPageToLocal,
  canvasQuizToLocal,
  fallbackDateFor,
  findImportCandidates,
} from "./canvasImport";

const context = { fallbackDate: "08/26/2026 23:59:00", assignmentGroupName: "Labs" };

const assignment = (overrides: Partial<CanvasAssignment>) =>
  ({
    id: 1,
    name: "Lab 1",
    description: "<p>Do the lab.</p>",
    published: true,
    submission_types: ["online_upload"],
    allowed_extensions: ["pdf"],
    points_possible: 10,
    assignment_group_id: 5,
    is_quiz_assignment: false,
    ...overrides,
  }) as CanvasAssignment;

const question = (overrides: Partial<CanvasQuizQuestion>) =>
  ({
    id: 1,
    quiz_id: 1,
    question_name: "Question",
    question_type: "multiple_choice_question",
    question_text: "<p>Pick one</p>",
    points_possible: 1,
    correct_comments: "",
    incorrect_comments: "",
    neutral_comments: "",
    answers: [],
    ...overrides,
  }) as CanvasQuizQuestion;

const quiz = {
  id: 9,
  title: "Quiz 1",
  description: "<p>Read chapter 1.</p>",
  due_at: "9/2/2026, 11:59:00 PM",
  shuffle_answers: true,
  show_correct_answers: false,
  one_question_at_a_time: false,
  allowed_attempts: 2,
  time_limit: 15,
} as CanvasQuiz;

describe("canvasHtmlToMarkdown", () => {
  it("converts headings, lists, emphasis and links to markdown", () => {
    const md = canvasHtmlToMarkdown(
      '<h2>Goal</h2><p>Write <strong>one</strong> <em>function</em>.</p><ul><li>a</li><li>b</li></ul><p><a href="/courses/1/files/2">notes</a></p><p>&nbsp;</p><hr>',
    );
    expect(md).toContain("## Goal");
    expect(md).toContain("Write **one** _function_.");
    expect(md).toMatch(/^- {1,3}a$/m);
    expect(md).toMatch(/\[notes\]\(https?:\/\/[^)]+\/courses\/1\/files\/2\)/);
    // a "---" line would end a file's settings section
    expect(md).not.toMatch(/^---$/m);
  });

  it("keeps tables as html and turns equation images into latex", () => {
    const md = canvasHtmlToMarkdown(
      '<table><tr><td>x</td></tr></table><p><img class="equation_image" data-equation-content="x^2" src="/eq"></p>',
    );
    expect(md).toContain("<table>");
    expect(md).toContain("$x^2$");
  });

  it("turns KaTeX back into its latex, or keeps it when the latex is gone", () => {
    const withLatex = canvasHtmlToMarkdown(
      '<p>Area <span class="katex"><math><semantics><mrow><mi>r</mi></mrow><annotation encoding="application/x-tex">\\pi r^2</annotation></semantics></math></span></p>',
    );
    expect(withLatex).toBe("Area $\\pi r^2$");
    const mathOnly = canvasHtmlToMarkdown(
      '<p>SLO <span class="katex"><math><mn>99.5</mn></math></span></p><link rel="stylesheet" href="theme.css">',
    );
    expect(mathOnly).toBe('SLO <span class="katex"><math><mn>99.5</mn></math></span>');
  });
});

describe("findImportCandidates", () => {
  const modules = [
    {
      id: 1,
      name: "Week 1",
      items: [
        { type: "Assignment", content_id: 1 },
        { type: "Page", page_url: "syllabus" },
      ],
    },
  ] as CanvasModule[];

  it("lists Canvas items with no file of the same name, leaving out a quiz's assignment", () => {
    const candidates = findImportCandidates({
      canvasAssignments: [
        assignment({ due_at: "9/1/2026, 11:59:00 PM" }),
        assignment({ id: 2, name: "Quiz 1", is_quiz_assignment: true, quiz_id: 9 }),
        assignment({ id: 3, name: "Already here" }),
      ],
      canvasQuizzes: [quiz],
      canvasPages: [
        { page_id: 4, url: "syllabus", title: "Syllabus", published: true } as CanvasPage,
      ],
      canvasModules: modules,
      localNames: {
        assignment: new Set(["Already here"]),
        quiz: new Set(),
        page: new Set(),
      },
    });
    expect(candidates.map((c) => `${c.type}:${c.name}`)).toEqual([
      "assignment:Lab 1",
      "quiz:Quiz 1",
      "page:Syllabus",
    ]);
    expect(candidates[0].dueAt).toBe("09/01/2026 23:59:00");
    expect(candidates[0].canvasModules).toEqual(["Week 1"]);

    // the page has no date of its own, so it takes its module's earliest
    expect(fallbackDateFor(candidates[2], candidates, "08/24/2026", { hour: 23, minute: 59 })).toBe(
      "09/01/2026 23:59:00",
    );
  });

  it("flags names that can't be file names", () => {
    const [candidate] = findImportCandidates({
      canvasAssignments: [assignment({ name: "Lab 1: Arrays" })],
      canvasQuizzes: [],
      canvasPages: [],
      canvasModules: [],
      localNames: { assignment: new Set(), quiz: new Set(), page: new Set() },
    });
    expect(candidate.nameError).toContain(":");
  });
});

describe("canvasAssignmentToLocal", () => {
  it("keeps the rubric, dropping Canvas's default ratings", () => {
    const { item, warnings } = canvasAssignmentToLocal(
      assignment({
        due_at: "9/1/2026, 11:59:00 PM",
        rubric: [
          {
            id: "a",
            description: "Works",
            long_description: "",
            points: 6,
            ratings: [
              { id: "1", description: "Full Marks", points: 6, long_description: "" },
              { id: "2", description: "No Marks", points: 0, long_description: "" },
            ],
          },
          {
            id: "b",
            description: "Style",
            long_description: "",
            points: 4,
            ratings: [
              { id: "3", description: "Clean", points: 4, long_description: "" },
              { id: "4", description: "Messy", points: 1, long_description: "" },
            ],
          },
        ],
      }),
      context,
    );
    expect(warnings).toEqual([]);
    expect(item.dueAt).toBe("09/01/2026 23:59:00");
    expect(item.localAssignmentGroupName).toBe("Labs");
    expect(item.rubric).toEqual([
      { label: "Works", points: 6 },
      {
        label: "Style",
        points: 4,
        ratings: [
          { points: 4, description: "Clean" },
          { points: 1, description: "Messy" },
        ],
      },
    ]);
    const reparsed = assignmentMarkdownParser.parseMarkdown(
      assignmentMarkdownSerializer.toMarkdown(item),
      item.name,
    );
    expect(reparsed.rubric).toEqual(item.rubric);
    expect(reparsed.description).toBe("Do the lab.");
  });

  it("keeps the points with one rubric row and uses the fallback date", () => {
    const { item, warnings } = canvasAssignmentToLocal(assignment({}), context);
    expect(item.rubric).toEqual([{ label: "Points", points: 10 }]);
    expect(item.dueAt).toBe(context.fallbackDate);
    expect(warnings).toHaveLength(2);
  });
});

describe("canvasPageToLocal", () => {
  it("dates the page with the fallback date", () => {
    const { item } = canvasPageToLocal(
      { page_id: 1, url: "x", title: "Syllabus", published: true, front_page: false, body: "<p>Hi</p>" },
      context,
    );
    expect(item).toEqual({ name: "Syllabus", text: "Hi", dueAt: context.fallbackDate });
  });
});

describe("canvasQuizToLocal", () => {
  const convert = (questions: CanvasQuizQuestion[]) =>
    canvasQuizToLocal(quiz, questions, context);

  it("keeps the quiz settings", () => {
    const { item } = convert([]);
    expect(item).toMatchObject({
      name: "Quiz 1",
      description: "Read chapter 1.",
      dueAt: "09/02/2026 23:59:00",
      shuffleAnswers: true,
      showCorrectAnswers: false,
      allowedAttempts: 2,
      timeLimit: 15,
      localAssignmentGroupName: "Labs",
    });
  });

  it("converts each question type the file has", () => {
    const { item, warnings } = convert([
      question({
        answers: [
          { id: 1, text: "Yes", weight: 100 },
          { id: 2, text: "No", weight: 0 },
        ],
        correct_comments: "Nice",
        incorrect_comments: "<p>Review chapter 1</p>",
      }),
      question({
        question_type: "multiple_answers_question",
        question_text: "<p>Pick some</p><ul><li>hint one</li></ul>",
        answers: [
          { id: 1, text: "A", weight: 100 },
          { id: 2, text: "B", weight: 0, html: "<p><code>B</code></p>" },
        ],
      }),
      question({ question_type: "true_false_question", answers: [
        { id: 1, text: "True", weight: 0 },
        { id: 2, text: "False", weight: 100 },
      ] }),
      question({ question_type: "essay_question", points_possible: 5 }),
      question({ question_type: "short_answer_question", answers: [
        { id: 1, text: "http", weight: 100 },
        { id: 2, text: "HTTP", weight: 100 },
      ] }),
      question({
        question_type: "matching_question",
        answers: [
          { id: 1, text: "", left: "GET - read", right: "fetch", weight: 100 },
          { id: 2, text: "", left: "POST", right: "create", weight: 100 },
        ],
        matching_answer_incorrect_matches: "delete\nnothing",
      }),
      question({ question_type: "numerical_question", answers: [
        { id: 1, text: "", weight: 100, numerical_answer_type: "exact_answer", exact: 42, margin: 0 },
        { id: 2, text: "", weight: 100, numerical_answer_type: "range_answer", start: 1, end: 3 },
      ] }),
      question({
        question_type: "fill_in_multiple_blanks_question",
        question_text: "<p>The [verb_1] method reads; [verb2] writes.</p>",
        answers: [
          { id: 1, text: "GET", weight: 100, blank_id: "verb_1" },
          { id: 2, text: "get", weight: 100, blank_id: "verb_1" },
          { id: 3, text: "POST", weight: 100, blank_id: "verb2" },
        ],
      }),
      question({
        question_type: "multiple_dropdowns_question",
        question_text: "<p>Match each status.</p><p>Not found: [d1]</p><p>OK [d2]</p>",
        answers: [
          { id: 1, text: "404", weight: 100, blank_id: "d1" },
          { id: 2, text: "200", weight: 0, blank_id: "d1" },
          { id: 3, text: "200", weight: 100, blank_id: "d2" },
          { id: 4, text: "500", weight: 0, blank_id: "d2" },
        ],
      }),
    ]);

    expect(warnings).toEqual([]);
    expect(item.questions.map((q) => q.questionType)).toEqual([
      QuestionType.MULTIPLE_CHOICE,
      QuestionType.MULTIPLE_ANSWERS,
      QuestionType.MULTIPLE_CHOICE,
      QuestionType.ESSAY,
      QuestionType.SHORT_ANSWER_WITH_ANSWERS,
      QuestionType.MATCHING,
      QuestionType.NUMERICAL,
      QuestionType.FILL_IN_MULTIPLE_BLANKS,
      QuestionType.MULTIPLE_DROPDOWNS,
    ]);
    expect(item.questions[0]).toMatchObject({
      correctComments: "Nice",
      incorrectComments: "Review chapter 1",
    });
    expect(item.questions[1].answers[1].text).toBe("`B`");
    expect(item.questions[5].matchDistractors).toEqual(["delete", "nothing"]);
    expect(item.questions[7].text).toBe("The [verb_1] method reads; [verb2] writes.");
    expect(item.questions[8].text).toBe("Match each status.");
    expect(item.questions[8].answers.filter((a) => a.text).map((a) => a.text)).toEqual([
      "Not found:",
      "OK",
    ]);

    // what lands in the file reads back as the same quiz
    const markdown = quizMarkdownUtils.toMarkdown(item);
    expect(quizMarkdownUtils.parseMarkdown(markdown, item.name)).toEqual(item);
  });

  it("imports a question the file can't hold as an essay, with a warning", () => {
    const { item, warnings } = convert([
      question({ question_type: "file_upload_question", points_possible: 3 }),
    ]);
    expect(item.questions[0]).toMatchObject({
      questionType: QuestionType.ESSAY,
      points: 3,
    });
    expect(warnings[0]).toContain("question 1 (file upload)");
  });
});
