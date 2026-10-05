import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  canvasQuizService,
  getAnswersForCanvas,
  getQuestionTextForCanvas,
  getQuestionTypeForCanvas,
} from "./canvasQuizService";
import { CanvasQuizQuestion } from "@/features/canvas/models/quizzes/canvasQuizQuestionModel";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import {
  LocalQuizQuestion,
  QuestionType,
} from "@/features/local/quizzes/models/localQuizQuestion";

// Mock the dependencies
vi.mock("@/services/axiosUtils", () => ({
  axiosClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("./canvasServiceUtils", () => ({
  canvasApi: "https://test.instructure.com/api/v1",
  paginatedRequest: vi.fn(),
}));

vi.mock("./canvasWebRequestUtils", () => ({
  rateLimitAwarePost: vi.fn(),
  rateLimitAwareDelete: vi.fn(),
}));

vi.mock("./canvasAssignmentService", () => ({
  canvasAssignmentService: {
    getAll: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@/services/htmlMarkdownUtils", () => ({
  markdownToHTMLSafe: vi.fn(({ markdownString }) => `<p>${markdownString}</p>`),
}));

vi.mock("@/features/local/utils/timeUtils", () => ({
  getDateFromStringOrThrow: vi.fn((dateString) => new Date(dateString)),
}));

vi.mock("@/services/utils/questionHtmlUtils", () => ({
  escapeMatchingText: vi.fn((text) => text),
}));

describe("canvasQuizService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getQuizQuestions", () => {
    it("should fetch and sort quiz questions by position", async () => {
      const mockQuestions: CanvasQuizQuestion[] = [
        {
          id: 3,
          quiz_id: 1,
          position: 3,
          question_name: "Question 3",
          question_type: "multiple_choice_question",
          question_text: "What is 2+2?",
          correct_comments: "",
          incorrect_comments: "",
          neutral_comments: "",
        },
        {
          id: 1,
          quiz_id: 1,
          position: 1,
          question_name: "Question 1",
          question_type: "multiple_choice_question",
          question_text: "What is your name?",
          correct_comments: "",
          incorrect_comments: "",
          neutral_comments: "",
        },
        {
          id: 2,
          quiz_id: 1,
          position: 2,
          question_name: "Question 2",
          question_type: "essay_question",
          question_text: "Describe yourself",
          correct_comments: "",
          incorrect_comments: "",
          neutral_comments: "",
        },
      ];

      const { paginatedRequest } = await import("./canvasServiceUtils");
      vi.mocked(paginatedRequest).mockResolvedValue(mockQuestions);

      const result = await canvasQuizService.getQuizQuestions(1, 1);

      expect(result).toHaveLength(3);
      expect(result[0].position).toBe(1);
      expect(result[1].position).toBe(2);
      expect(result[2].position).toBe(3);
      expect(result[0].question_text).toBe("What is your name?");
      expect(result[1].question_text).toBe("Describe yourself");
      expect(result[2].question_text).toBe("What is 2+2?");
    });

    it("should handle questions without position", async () => {
      const mockQuestions: CanvasQuizQuestion[] = [
        {
          id: 1,
          quiz_id: 1,
          question_name: "Question 1",
          question_type: "multiple_choice_question",
          question_text: "What is your name?",
          correct_comments: "",
          incorrect_comments: "",
          neutral_comments: "",
        },
        {
          id: 2,
          quiz_id: 1,
          question_name: "Question 2",
          question_type: "essay_question",
          question_text: "Describe yourself",
          correct_comments: "",
          incorrect_comments: "",
          neutral_comments: "",
        },
      ];

      const { paginatedRequest } = await import("./canvasServiceUtils");
      vi.mocked(paginatedRequest).mockResolvedValue(mockQuestions);

      const result = await canvasQuizService.getQuizQuestions(1, 1);

      expect(result).toHaveLength(2);
      // Should maintain original order when no position is specified
    });
  });

  describe("Question order verification (integration test concept)", () => {
    it("should detect correct question order", async () => {
      // This is a conceptual test showing what the verification should validate
      const _localQuiz: LocalQuiz = {
        name: "Test Quiz",
        description: "A test quiz",
        dueAt: "2023-12-01T23:59:00Z",
        shuffleAnswers: false,
        showCorrectAnswers: true,
        oneQuestionAtATime: false,
        allowedAttempts: 1,
        questions: [
          {
            text: "What is your name?",
            questionType: QuestionType.SHORT_ANSWER,
            points: 5,
            answers: [],
            matchDistractors: [],
          },
          {
            text: "Describe yourself",
            questionType: QuestionType.ESSAY,
            points: 10,
            answers: [],
            matchDistractors: [],
          },
          {
            text: "What is 2+2?",
            questionType: QuestionType.MULTIPLE_CHOICE,
            points: 5,
            answers: [
              { text: "3", correct: false },
              { text: "4", correct: true },
              { text: "5", correct: false },
            ],
            matchDistractors: [],
          },
        ],
      };

      const canvasQuestions: CanvasQuizQuestion[] = [
        {
          id: 1,
          quiz_id: 1,
          position: 1,
          question_name: "Question 1",
          question_type: "short_answer_question",
          question_text: "<p>What is your name?</p>",
          correct_comments: "",
          incorrect_comments: "",
          neutral_comments: "",
        },
        {
          id: 2,
          quiz_id: 1,
          position: 2,
          question_name: "Question 2",
          question_type: "essay_question",
          question_text: "<p>Describe yourself</p>",
          correct_comments: "",
          incorrect_comments: "",
          neutral_comments: "",
        },
        {
          id: 3,
          quiz_id: 1,
          position: 3,
          question_name: "Question 3",
          question_type: "multiple_choice_question",
          question_text: "<p>What is 2+2?</p>",
          correct_comments: "",
          incorrect_comments: "",
          neutral_comments: "",
        },
      ];

      // Mock the getQuizQuestions to return our test data
      const { paginatedRequest } = await import("./canvasServiceUtils");
      vi.mocked(paginatedRequest).mockResolvedValue(canvasQuestions);

      const result = await canvasQuizService.getQuizQuestions(1, 1);

      // Verify the questions are in the expected order
      expect(result).toHaveLength(3);
      expect(result[0].question_text).toContain("What is your name?");
      expect(result[1].question_text).toContain("Describe yourself");
      expect(result[2].question_text).toContain("What is 2+2?");

      // Verify positions are sequential
      expect(result[0].position).toBe(1);
      expect(result[1].position).toBe(2);
      expect(result[2].position).toBe(3);
    });
  });

  describe("getAnswersForCanvas", () => {
    it("includes matching distractors", () => {
      const answers = getAnswersForCanvas(
        {
          text: "Match the following terms",
          questionType: QuestionType.MATCHING,
          points: 2,
          answers: [
            {
              text: "statement",
              matchedText: "a single command to be executed",
              correct: true,
            },
          ],
          matchDistractors: ["reserved word"],
        },
        {} as never
      );

      expect(answers).toEqual([
        {
          answer_match_left: "statement",
          answer_match_right: "a single command to be executed",
          matching_answer_incorrect_matches: "reserved word",
        },
      ]);
    });
  });

  describe("create", () => {
    it("sends matching distractors on the question payload", async () => {
      const { rateLimitAwarePost } = await import("./canvasWebRequestUtils");

      vi.spyOn(canvasQuizService, "getQuizQuestions").mockResolvedValue([]);
      vi.mocked(rateLimitAwarePost).mockImplementation(async () => ({
        data: { id: 1 },
      }) as never);

      await canvasQuizService.create(
        42,
        {
          name: "Matching Quiz",
          description: "",
          dueAt: "2023-12-01T23:59:00Z",
          shuffleAnswers: false,
          showCorrectAnswers: true,
          oneQuestionAtATime: false,
          allowedAttempts: 1,
          questions: [
            {
              text: "Match the following terms",
              questionType: QuestionType.MATCHING,
              points: 2,
              answers: [
                {
                  text: "statement",
                  matchedText: "a single command to be executed",
                  correct: true,
                },
              ],
              matchDistractors: ["reserved word"],
            },
          ],
        } as LocalQuiz,
        {} as never
      );

      const questionRequest = vi
        .mocked(rateLimitAwarePost)
        .mock.calls.find(([url]) => url.endsWith("/questions"));

      const questionPayload = questionRequest?.[1] as
        | {
            question?: {
              matching_answer_incorrect_matches?: string;
            };
          }
        | undefined;

      expect(questionPayload?.question?.matching_answer_incorrect_matches).toBe(
        "reserved word"
      );
    });

    it("sends a multiple dropdowns question with one [blank] per prompt", async () => {
      const { rateLimitAwarePost } = await import("./canvasWebRequestUtils");

      vi.spyOn(canvasQuizService, "getQuizQuestions").mockResolvedValue([]);
      vi.mocked(rateLimitAwarePost).mockImplementation(async () => ({
        data: { id: 1 },
      }) as never);

      await canvasQuizService.create(
        42,
        {
          name: "Dropdowns Quiz",
          description: "",
          dueAt: "2023-12-01T23:59:00Z",
          shuffleAnswers: true,
          showCorrectAnswers: true,
          oneQuestionAtATime: false,
          allowedAttempts: 1,
          questions: [planningQuestion],
        } as LocalQuiz,
        {} as never
      );

      const questionRequest = vi
        .mocked(rateLimitAwarePost)
        .mock.calls.find(([url]) => url.endsWith("/questions"));
      const question = (
        questionRequest?.[1] as { question: Record<string, unknown> }
      ).question;

      expect(question.question_type).toBe("multiple_dropdowns_question");
      expect(question.question_text).toBe(
        "<p>Plan the nested function.\n\nName: [dropdown1]\n\nCombine: [dropdown2]</p>"
      );
      expect(question.answers).toEqual(
        getAnswersForCanvas(planningQuestion, {} as never)
      );
      expect(question).not.toHaveProperty("matching_answer_incorrect_matches");
    });
  });

  describe("multiple dropdowns", () => {
    it("is sent to canvas as a multiple_dropdowns_question", () => {
      expect(getQuestionTypeForCanvas(planningQuestion)).toBe(
        "multiple_dropdowns_question"
      );
    });

    it("gives each prompt its own dropdown of only its group's answers", () => {
      expect(getAnswersForCanvas(planningQuestion, {} as never)).toEqual([
        { blank_id: "dropdown1", answer_text: "min_cost_from", answer_weight: 100 },
        { blank_id: "dropdown1", answer_text: "paint_next", answer_weight: 0 },
        { blank_id: "dropdown1", answer_text: "total_so_far", answer_weight: 0 },
        { blank_id: "dropdown2", answer_text: "minimum", answer_weight: 100 },
        { blank_id: "dropdown2", answer_text: "sum", answer_weight: 0 },
        { blank_id: "dropdown2", answer_text: "maximum", answer_weight: 0 },
      ]);
    });

    // Canvas shuffles dropdown options itself when the quiz has shuffle answers on
    // (only true/false, matching, and fill-in-multiple-blanks are exempt), so the
    // file order is kept for when shuffling is off and the order is deliberate.
    it("lists each dropdown's options in the order they were written", () => {
      const answers = dropdownAnswersForCanvas(
        dropdowns([
          [
            ["Combine", "zzz correct"],
            ["", "aaa distractor"],
            ["", "mmm distractor"],
          ],
        ])
      );

      expect(answers.map((a) => a.answer_text)).toEqual([
        "zzz correct",
        "aaa distractor",
        "mmm distractor",
      ]);
    });

    it("lets prompts in one group share options, and lists a shared answer once", () => {
      const answers = getAnswersForCanvas(
        dropdowns([
          [
            ["Counting paths", "sum"],
            ["Counting decodings", "sum"],
            ["Fewest coins", "minimum"],
            ["", "product"],
          ],
        ]),
        {} as never
      );

      expect(answers).toEqual([
        { blank_id: "dropdown1", answer_text: "sum", answer_weight: 100 },
        { blank_id: "dropdown1", answer_text: "minimum", answer_weight: 0 },
        { blank_id: "dropdown1", answer_text: "product", answer_weight: 0 },
        { blank_id: "dropdown2", answer_text: "sum", answer_weight: 100 },
        { blank_id: "dropdown2", answer_text: "minimum", answer_weight: 0 },
        { blank_id: "dropdown2", answer_text: "product", answer_weight: 0 },
        { blank_id: "dropdown3", answer_text: "sum", answer_weight: 0 },
        { blank_id: "dropdown3", answer_text: "minimum", answer_weight: 100 },
        { blank_id: "dropdown3", answer_text: "product", answer_weight: 0 },
      ]);
    });

    it("never offers another group's answers", () => {
      const nameOptions = dropdownAnswersForCanvas(planningQuestion)
        .filter((a) => a.blank_id === "dropdown1")
        .map((a) => a.answer_text);

      expect(nameOptions).not.toContain("minimum");
      expect(nameOptions).not.toContain("sum");
    });

    it("numbers the dropdowns in prompt order across groups", () => {
      expect(
        getQuestionTextForCanvas(
          dropdowns([
            [
              ["First", "a"],
              ["Second", "b"],
            ],
            [["Third", "c"]],
          ])
        )
      ).toBe(
        "Question\n\nFirst: [dropdown1]\n\nSecond: [dropdown2]\n\nThird: [dropdown3]"
      );
    });

    it("does not add a colon after a prompt that already ends in punctuation", () => {
      expect(
        getQuestionTextForCanvas(
          dropdowns([[["Name:", "a"]], [["What does it return?", "b"]]])
        )
      ).toBe("Question\n\nName: [dropdown1]\n\nWhat does it return? [dropdown2]");
    });

    it("leaves the text of other question types alone", () => {
      expect(
        getQuestionTextForCanvas({
          text: "Match these",
          questionType: QuestionType.MATCHING,
          points: 1,
          answers: [{ text: "a", matchedText: "b", correct: true }],
          matchDistractors: [],
        })
      ).toBe("Match these");
    });
  });

  describe("update", () => {
    const quiz = {
      name: "Quiz",
      description: "",
      shuffleAnswers: false,
      showCorrectAnswers: false,
      oneQuestionAtATime: false,
      allowedAttempts: 1,
      questions: [
        { text: "first", questionType: QuestionType.ESSAY, points: 1, answers: [] },
        { text: "second", questionType: QuestionType.ESSAY, points: 1, answers: [] },
      ],
    } as unknown as LocalQuiz;

    const updateWithCanvasPublished = async (published: boolean) => {
      const { axiosClient } = await import("@/services/axiosUtils");
      const { rateLimitAwarePost, rateLimitAwareDelete } = await import(
        "./canvasWebRequestUtils"
      );
      vi.mocked(axiosClient.put).mockResolvedValue({ data: { published } });
      vi.mocked(rateLimitAwarePost).mockResolvedValue({ data: { id: 9 } } as never);
      vi.spyOn(canvasQuizService, "getQuizQuestions").mockResolvedValue([
        { id: 101 },
        { id: 102 },
        { id: 103 },
      ] as CanvasQuizQuestion[]);
      const steps: string[] = [];

      const summary = await canvasQuizService.update(42, 7, quiz, {} as never, {
        onStep: (step) => steps.push(step),
      });
      return { summary, steps, axiosClient, rateLimitAwarePost, rateLimitAwareDelete };
    };

    it("replaces the Canvas questions with the file's questions", async () => {
      const { rateLimitAwarePost, rateLimitAwareDelete } =
        await updateWithCanvasPublished(false);

      expect(vi.mocked(rateLimitAwareDelete).mock.calls.map(([url]) => url)).toEqual([
        "https://test.instructure.com/api/v1/courses/42/quizzes/7/questions/101",
        "https://test.instructure.com/api/v1/courses/42/quizzes/7/questions/102",
        "https://test.instructure.com/api/v1/courses/42/quizzes/7/questions/103",
      ]);
      const created = vi
        .mocked(rateLimitAwarePost)
        .mock.calls.filter(([url]) => url.endsWith("/questions"));
      expect(created).toHaveLength(2);
    });

    it("saves a published quiz again so students see the new questions", async () => {
      const { axiosClient, summary } = await updateWithCanvasPublished(true);

      const puts = vi.mocked(axiosClient.put).mock.calls;
      expect(puts).toHaveLength(2);
      expect(puts[1][1]).toEqual({ quiz: { published: true } });
      expect(summary).toEqual({ questionsRemoved: 3, questionsAdded: 2, republished: true });
    });

    it("leaves an unpublished quiz unpublished", async () => {
      const { axiosClient, summary } = await updateWithCanvasPublished(false);

      expect(vi.mocked(axiosClient.put).mock.calls).toHaveLength(1);
      expect(summary.republished).toBe(false);
    });

    it("reports each step as it goes", async () => {
      const { steps } = await updateWithCanvasPublished(true);

      expect(steps).toEqual([
        "Updating quiz settings",
        "Removing 3 questions from Canvas",
        "Adding 2 questions from the file",
        "Saving the published quiz so students see the new questions",
      ]);
    });
  });

  describe("countSubmissions", () => {
    it("counts real attempts, not students who only have settings like extra time", async () => {
      const { paginatedRequest } = await import("./canvasServiceUtils");
      vi.mocked(paginatedRequest).mockResolvedValue([
        { quiz_submissions: [{ workflow_state: "complete" }, { workflow_state: "settings_only" }] },
        { quiz_submissions: [{ workflow_state: "untaken" }] },
      ]);

      expect(await canvasQuizService.countSubmissions(42, 7)).toBe(2);
    });
  });
});

const dropdownAnswersForCanvas = (question: LocalQuizQuestion) =>
  getAnswersForCanvas(question, {} as never) as {
    blank_id: string;
    answer_text: string;
    answer_weight: number;
  }[];

// groups of [prompt, answer] pairs; an empty prompt marks a distractor
const dropdowns = (groups: [string, string][][]): LocalQuizQuestion => ({
  text: "Question",
  questionType: QuestionType.MULTIPLE_DROPDOWNS,
  points: 1,
  matchDistractors: [],
  answers: groups.flatMap((group, dropdownGroup) =>
    group.map(([text, matchedText]) => ({
      correct: text !== "",
      text,
      matchedText,
      dropdownGroup,
    }))
  ),
});

const planningQuestion: LocalQuizQuestion = {
  text: "Plan the nested function.\n",
  questionType: QuestionType.MULTIPLE_DROPDOWNS,
  points: 2,
  matchDistractors: [],
  answers: [
    { correct: true, text: "Name", matchedText: "min_cost_from", dropdownGroup: 0 },
    { correct: false, text: "", matchedText: "paint_next", dropdownGroup: 0 },
    { correct: false, text: "", matchedText: "total_so_far", dropdownGroup: 0 },
    { correct: true, text: "Combine", matchedText: "minimum", dropdownGroup: 1 },
    { correct: false, text: "", matchedText: "sum", dropdownGroup: 1 },
    { correct: false, text: "", matchedText: "maximum", dropdownGroup: 1 },
  ],
};
