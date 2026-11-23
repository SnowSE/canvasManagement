// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { pullFromCanvas } from "./pullFromCanvas";
import { descriptionRenderer, getSyncReport } from "@/app/course/[courseName]/calendar/day/getAssignmentSyncStatus";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import { CanvasQuiz } from "@/features/canvas/models/quizzes/canvasQuizModel";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";

const settings = { name: "course", canvasId: 100, assets: [], assignmentGroups: [{ id: "1", name: "Labs", weight: 50, canvasId: 7 }, { id: "2", name: "Exams", weight: 50, canvasId: 8 }] } as unknown as LocalCourseSettings;
const assignment = { name: "Lab 1", description: "hello world", dueAt: "08/21/2023 23:59:00", lockAt: "08/25/2023 23:59:00", localAssignmentGroupName: "Labs", submissionTypes: [], rubric: [], allowedFileUploadExtensions: [] } as unknown as LocalAssignment;
const inCanvas = (more: Partial<CanvasAssignment>) =>
  ({ id: 1, name: "Lab 1", description: "<p>hello world</p>", due_at: "08/21/2023 23:59:00", lock_at: "08/25/2023 23:59:00", assignment_group_id: 7, published: true, submission_types: [], ...more }) as CanvasAssignment;
const quiz = { name: "Quiz 1", description: "", dueAt: "08/21/2023 23:59:00", shuffleAnswers: true, showCorrectAnswers: true, oneQuestionAtATime: false, allowedAttempts: 1, localAssignmentGroupName: "Labs", questions: [] } as unknown as LocalQuiz;
const quizInCanvas = (more: Partial<CanvasQuiz>) =>
  ({ id: 1, title: "Quiz 1", description: "", due_at: "08/21/2023 23:59:00", shuffle_answers: true, show_correct_answers: true, one_question_at_a_time: false, allowed_attempts: 1, assignment_group_id: 7, published: true, ...more }) as CanvasQuiz;

/** What pulling changes in the file, and what the compare page says afterwards. */
const pullAssignment = (canvas: CanvasAssignment) => {
  const report = getSyncReport({ item: assignment, canvasItem: canvas, type: "assignment", settings });
  const pull = pullFromCanvas("assignment", assignment, canvas, report.differences, settings);
  const after = getSyncReport({ item: pull.item, canvasItem: canvas, type: "assignment", settings });
  return { ...pull, stillDifferent: after.differences.map((d) => d.key) };
};

describe("pulling from Canvas: the file takes Canvas's value where they differ", () => {
  it("takes a due date, in the file's own date form", () => {
    expect(pullAssignment(inCanvas({ due_at: "2023-08-23T05:59:00Z" })).item.dueAt).toBe("08/22/2023 23:59:00");
  });
  it("leaves no difference where it pulled", () => {
    expect(pullAssignment(inCanvas({ due_at: "08/23/2023 23:59:00", lock_at: "08/30/2023 23:59:00", assignment_group_id: 8 })).stillDifferent).toEqual([]);
  });
  it("changes nothing else in the file", () => {
    expect(pullAssignment(inCanvas({ due_at: "08/23/2023 23:59:00" })).item).toEqual({ ...assignment, dueAt: "08/23/2023 23:59:00" });
  });
  it("drops a lock date Canvas doesn't have", () => {
    expect(pullAssignment(inCanvas({ lock_at: undefined })).item.lockAt).toBeUndefined();
  });
  it("takes the assignment group, by the name the course gives Canvas's group", () => {
    expect(pullAssignment(inCanvas({ assignment_group_id: 8 })).item.localAssignmentGroupName).toBe("Exams");
  });
  it("says which rows it pulled", () => {
    expect(pullAssignment(inCanvas({ due_at: "08/23/2023 23:59:00", assignment_group_id: 8 })).pulled.map((f) => f.label)).toEqual(["Due", "Assignment group"]);
  });
  it("leaves a row it can't pull as it is, and says so", () => {
    const pull = pullAssignment(inCanvas({ description: "<p>changed in Canvas</p>", due_at: "08/23/2023 23:59:00" }));
    expect([pull.item.description, pull.left.map((f) => f.label)]).toEqual(["hello world", ["Description"]]);
  });
  it("takes the description's blocks that differ, the rest staying as the file wrote them", () => {
    const withTwo = { ...assignment, description: "Keep *this*.\n\nChange this." };
    const canvas = inCanvas({ description: "<p>Keep <em>this</em>.</p><p>Changed in Canvas.</p>" });
    const report = getSyncReport({ item: withTwo, canvasItem: canvas, type: "assignment", settings });
    const pull = pullFromCanvas("assignment", withTwo, canvas, report.differences, settings, descriptionRenderer("assignment", withTwo, settings));
    expect([pull.item.description, pull.left]).toEqual(["Keep *this*.\n\n<p>Changed in Canvas.</p>\n", []]);
  });
  it("takes a page's text the same way", () => {
    const page = { name: "Tour", text: "Keep *this*.\n\nChange this.", dueAt: "08/21/2023 23:59:00" };
    const canvas = { page_id: 1, url: "tour", title: "Tour", published: true, body: "<p>Keep <em>this</em>.</p><p>Changed in Canvas.</p>" } as never;
    const report = getSyncReport({ item: page, canvasItem: canvas, type: "page", settings });
    expect(pullFromCanvas("page", page, canvas, report.differences, settings, descriptionRenderer("page", page, settings)).item.text).toBe("Keep *this*.\n\n<p>Changed in Canvas.</p>\n");
  });
  it("takes a quiz's settings: its password, time limit and options", () => {
    const canvas = quizInCanvas({ access_code: "open sesame", time_limit: 30, shuffle_answers: false, allowed_attempts: -1 });
    const report = getSyncReport({ item: quiz, canvasItem: canvas, type: "quiz", settings });
    const pulled = pullFromCanvas("quiz", quiz, canvas, report.differences, settings).item;
    expect(pulled).toMatchObject({ password: "open sesame", timeLimit: 30, shuffleAnswers: false, allowedAttempts: -1 });
  });
});
