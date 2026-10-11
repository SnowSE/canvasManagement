import { describe, it, expect } from "vitest";
import { getSyncReport, getSyncStatus } from "./getAssignmentSyncStatus";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { CanvasQuiz } from "@/features/canvas/models/quizzes/canvasQuizModel";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import { CanvasRubricCriteria } from "@/features/canvas/models/assignments/canvasRubricCriteria";
import { AssignmentSubmissionType } from "@/features/local/assignments/models/assignmentSubmissionType";
import {
  DayOfWeek,
  LocalCourseSettings,
} from "@/features/local/course/localCourseSettings";

const baseSettings: LocalCourseSettings = {
  name: "test course",
  assignmentGroups: [],
  daysOfWeek: [DayOfWeek.Monday, DayOfWeek.Wednesday],
  startDate: "01/01/2024 00:00:00",
  endDate: "05/01/2024 00:00:00",
  defaultDueTime: { hour: 23, minute: 59 },
  canvasId: 100,
  defaultAssignmentSubmissionTypes: [],
  defaultFileUploadTypes: [],
  holidays: [],
  assets: [],
};

const baseLocalAssignment: LocalAssignment = {
  name: "Test Assignment",
  description: "hello world",
  dueAt: "08/21/2023 23:59:00",
  submissionTypes: [AssignmentSubmissionType.ONLINE_UPLOAD],
  rubric: [],
  allowedFileUploadExtensions: [],
};

const baseCanvasAssignment: CanvasAssignment = {
  id: 1,
  name: "Test Assignment",
  description: "<p>hello world</p>",
  created_at: "2023-08-01T00:00:00Z",
  has_overrides: false,
  course_id: 100,
  html_url: "",
  submissions_download_url: "",
  assignment_group_id: 0,
  due_date_required: false,
  max_name_length: 255,
  peer_reviews: false,
  automatic_peer_reviews: false,
  position: 1,
  grading_type: "points",
  published: true,
  unpublishable: false,
  only_visible_to_overrides: false,
  locked_for_user: false,
  moderated_grading: false,
  grader_count: 0,
  allowed_attempts: -1,
  is_quiz_assignment: false,
  submission_types: ["online_upload"],
  due_at: "08/21/2023 23:59:00",
};

describe("getSyncStatus - assignment", () => {
  it("returns localOnly when no canvas item", () => {
    const result = getSyncStatus({
      item: baseLocalAssignment,
      canvasItem: undefined,
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("localOnly");
  });

  it("marks an unpublished item incomplete without counting it as a difference", () => {
    const result = getSyncStatus({
      item: baseLocalAssignment,
      canvasItem: { ...baseCanvasAssignment, published: false },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.unpublished).toBe(true);
    expect(result.message).toContain("not published");
    expect(result.differences).toEqual([]);
  });

  it("returns incomplete when due date missing in canvas", () => {
    const result = getSyncStatus({
      item: baseLocalAssignment,
      canvasItem: { ...baseCanvasAssignment, due_at: undefined },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toContain("due date");
  });

  it("returns incomplete when lock date missing in canvas but set locally", () => {
    const result = getSyncStatus({
      item: { ...baseLocalAssignment, lockAt: "08/21/2023 23:59:00" },
      canvasItem: { ...baseCanvasAssignment, lock_at: undefined },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toContain("lock date");
  });

  it("returns incomplete when assignment group differs", () => {
    const settings: LocalCourseSettings = {
      ...baseSettings,
      assignmentGroups: [
        { id: "group-1", name: "Homework", weight: 30, canvasId: 42 },
      ],
    };
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        localAssignmentGroupName: "Homework",
      },
      canvasItem: {
        ...baseCanvasAssignment,
        assignment_group_id: 99, // different from canvasId 42
      },
      type: "assignment",
      settings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toBe("assignment group is different");
  });

  it("returns published when assignment groups match", () => {
    const settings: LocalCourseSettings = {
      ...baseSettings,
      assignmentGroups: [
        { id: "group-1", name: "Homework", weight: 30, canvasId: 42 },
      ],
    };
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        localAssignmentGroupName: "Homework",
      },
      canvasItem: {
        ...baseCanvasAssignment,
        assignment_group_id: 42,
      },
      type: "assignment",
      settings,
    });
    expect(result.status).toBe("published");
  });

  it("returns incomplete when assignment group has no canvasId", () => {
    const settings: LocalCourseSettings = {
      ...baseSettings,
      assignmentGroups: [
        { id: "group-1", name: "Homework", weight: 30 }, // no canvasId
      ],
    };
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        localAssignmentGroupName: "Homework",
      },
      canvasItem: {
        ...baseCanvasAssignment,
        assignment_group_id: 99,
      },
      type: "assignment",
      settings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toBe("assignment group not found in canvas");
  });

  it("returns published when local assignment group name is unset", () => {
    const result = getSyncStatus({
      item: baseLocalAssignment,
      canvasItem: baseCanvasAssignment,
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("published");
  });
});

describe("getSyncStatus - rubric comparison", () => {
  const baseCanvasRubricItem: CanvasRubricCriteria = {
    id: "crit-1",
    description: "Code Quality",
    long_description: "",
    points: 10,
  };

  it("returns incomplete when local has rubric items but canvas has none", () => {
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        rubric: [{ label: "Code Quality", points: 10 }],
      },
      canvasItem: { ...baseCanvasAssignment, rubric: undefined },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toBe("rubric count is different");
  });

  it("returns incomplete when rubric item counts differ", () => {
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        rubric: [
          { label: "Code Quality", points: 10 },
          { label: "Documentation", points: 5 },
        ],
      },
      canvasItem: {
        ...baseCanvasAssignment,
        rubric: [baseCanvasRubricItem],
      },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toBe("rubric count is different");
  });

  it("returns incomplete when rubric item label differs", () => {
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        rubric: [{ label: "Different Label", points: 10 }],
      },
      canvasItem: {
        ...baseCanvasAssignment,
        rubric: [baseCanvasRubricItem],
      },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toBe("rubric description or points is different");
  });

  it("returns incomplete when rubric item points differ", () => {
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        rubric: [{ label: "Code Quality", points: 20 }],
      },
      canvasItem: {
        ...baseCanvasAssignment,
        rubric: [baseCanvasRubricItem],
      },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toBe("rubric description or points is different");
  });

  it("returns published when rubric items match without ratings", () => {
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        rubric: [{ label: "Code Quality", points: 10 }],
      },
      canvasItem: {
        ...baseCanvasAssignment,
        rubric: [baseCanvasRubricItem],
      },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("published");
  });

  it("returns incomplete when rubric sub-item (rating) description differs", () => {
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        rubric: [
          {
            label: "Code Quality",
            points: 10,
            ratings: [
              { points: 10, description: "Excellent" },
              { points: 0, description: "Poor" },
            ],
          },
        ],
      },
      canvasItem: {
        ...baseCanvasAssignment,
        rubric: [
          {
            ...baseCanvasRubricItem,
            ratings: [
              { id: "r1", points: 10, description: "Outstanding", long_description: "" },
              { id: "r2", points: 0, description: "Poor", long_description: "" },
            ],
          },
        ],
      },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toBe("rubric rating description or points is different");
  });

  it("returns incomplete when rubric sub-item (rating) points differ", () => {
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        rubric: [
          {
            label: "Code Quality",
            points: 10,
            ratings: [
              { points: 10, description: "Excellent" },
              { points: 0, description: "Poor" },
            ],
          },
        ],
      },
      canvasItem: {
        ...baseCanvasAssignment,
        rubric: [
          {
            ...baseCanvasRubricItem,
            ratings: [
              { id: "r1", points: 8, description: "Excellent", long_description: "" },
              { id: "r2", points: 0, description: "Poor", long_description: "" },
            ],
          },
        ],
      },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toBe("rubric rating description or points is different");
  });

  it("returns incomplete when rubric sub-item count differs", () => {
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        rubric: [
          {
            label: "Code Quality",
            points: 10,
            ratings: [
              { points: 10, description: "Excellent" },
              { points: 5, description: "Partial" },
              { points: 0, description: "Poor" },
            ],
          },
        ],
      },
      canvasItem: {
        ...baseCanvasAssignment,
        rubric: [
          {
            ...baseCanvasRubricItem,
            ratings: [
              { id: "r1", points: 10, description: "Excellent", long_description: "" },
              { id: "r2", points: 0, description: "Poor", long_description: "" },
            ],
          },
        ],
      },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toBe("rubric ratings count is different");
  });

  it("returns published when rubric items and sub-items all match", () => {
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        rubric: [
          {
            label: "Code Quality",
            points: 10,
            ratings: [
              { points: 10, description: "Excellent" },
              { points: 0, description: "Poor" },
            ],
          },
        ],
      },
      canvasItem: {
        ...baseCanvasAssignment,
        rubric: [
          {
            ...baseCanvasRubricItem,
            ratings: [
              { id: "r1", points: 10, description: "Excellent", long_description: "" },
              { id: "r2", points: 0, description: "Poor", long_description: "" },
            ],
          },
        ],
      },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("published");
  });

  it("returns published when local has no ratings and canvas rubric matches label and points", () => {
    const result = getSyncStatus({
      item: {
        ...baseLocalAssignment,
        rubric: [{ label: "Code Quality", points: 10 }],
      },
      canvasItem: {
        ...baseCanvasAssignment,
        rubric: [
          {
            ...baseCanvasRubricItem,
            ratings: [
              { id: "r1", points: 10, description: "Full Marks", long_description: "" },
              { id: "r2", points: 0, description: "No Marks", long_description: "" },
            ],
          },
        ],
      },
      type: "assignment",
      settings: baseSettings,
    });
    expect(result.status).toBe("published");
  });
});

describe("getSyncStatus - page", () => {
  const page = { name: "Belts", text: "hello world", dueAt: "08/21/2023 23:59:00" };
  const canvasPage = {
    page_id: 1,
    url: "belts",
    title: "Belts",
    published: true,
    front_page: false,
    body: "<p>hello world</p>",
  };

  it("returns published when the content matches", () => {
    const result = getSyncStatus({
      item: page,
      canvasItem: canvasPage,
      type: "page",
      settings: baseSettings,
    });
    expect(result.status).toBe("published");
  });

  it("returns incomplete when the content differs", () => {
    const result = getSyncStatus({
      item: { ...page, text: "hello there" },
      canvasItem: canvasPage,
      type: "page",
      settings: baseSettings,
    });
    expect(result.status).toBe("incomplete");
    expect(result.message).toContain("different");
  });
});

describe("getSyncReport - quiz options", () => {
  const quiz: LocalQuiz = {
    name: "Quiz",
    description: "",
    password: "demo",
    dueAt: "08/21/2023 23:59:00",
    shuffleAnswers: true,
    showCorrectAnswers: true,
    oneQuestionAtATime: false,
    allowedAttempts: 1,
    questions: [],
  };
  const canvasQuiz = {
    id: 1,
    title: "Quiz",
    description: "",
    due_at: "08/21/2023 23:59:00",
    access_code: "demo",
    shuffle_answers: true,
    show_correct_answers: true,
    one_question_at_a_time: false,
    allowed_attempts: 1,
  } as CanvasQuiz;
  const report = (canvas: Partial<CanvasQuiz>, local: Partial<LocalQuiz> = {}) =>
    getSyncReport({
      item: { ...quiz, ...local },
      canvasItem: { ...canvasQuiz, ...canvas },
      type: "quiz",
      settings: baseSettings,
    });

  it("matches when every option agrees", () => {
    expect(report({}).fields.filter((f) => !f.same)).toEqual([]);
  });

  it("reports each option that differs", () => {
    const fields = report({
      access_code: "old",
      shuffle_answers: false,
      show_correct_answers: false,
      one_question_at_a_time: true,
      allowed_attempts: -1,
    }).fields.filter((f) => !f.same);
    expect(fields.map((f) => f.label)).toEqual([
      "Password",
      "Shuffle answers",
      "Show correct answers",
      "One question at a time",
      "Allowed attempts",
    ]);
  });

  it("treats no password and an empty one as the same", () => {
    expect(
      report({ access_code: undefined }, { password: undefined }).fields.filter((f) => !f.same),
    ).toEqual([]);
    expect(
      report({ access_code: "" }, { password: undefined }).fields.filter((f) => !f.same),
    ).toEqual([]);
  });
});
