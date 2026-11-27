// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { CanvasFile } from "@/features/canvas/services/files/canvasCourseFileService";
import { withCanvasFiles } from "@/features/canvas/services/files/fileSyncStatus";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { useMarkdownItemStatusOf } from "./useMarkdownItemStatus";

// What the module list and the calendar say of a page, with Canvas and the
// course as Canvas's own answers and the course's files would have them.
const settings = { name: "Survey", canvasId: 42, assets: [], assignmentGroups: [] } as unknown as LocalCourseSettings;
const studies: CanvasFile = { id: 209208898, display_name: "rust-studies.html", path: "04 - Rust/files/rust-studies.html", size: 10, locked: false };
const page = { name: "Rust", dueAt: "09/01/2026 09:00:00", text: "Practice: [Studies in Rust](../files/rust-studies.html)" };
// what Update in Canvas sent: the link pointing at the file's copy in Canvas
const sentBody = markdownToHTMLSafe({ markdownString: page.text, settings: withCanvasFiles(settings, [studies]) });
const canvas = vi.hoisted(() => ({ pageBody: "" }));

vi.mock("@/features/local/course/localCoursesHooks", () => ({ useLocalCourseSettingsQuery: () => ({ data: settings }) }));
vi.mock("@/features/canvas/hooks/canvasAssignmentHooks", () => ({ useCanvasAssignmentsQuery: () => ({ data: [] }) }));
const quizzes = vi.hoisted(() => ({ inCanvas: [] as object[], questions: {} as Record<string, object[] | undefined> }));
vi.mock("@/features/canvas/hooks/canvasQuizHooks", () => ({ useCanvasQuizzesQuery: () => ({ data: quizzes.inCanvas }) }));
vi.mock("@/features/canvas/hooks/canvasPageHooks", () => ({
  useCanvasPagesQuery: () => ({ data: [{ page_id: 1, url: "rust", title: "Rust", published: true, front_page: false, body: canvas.pageBody }] }),
}));
vi.mock("@/features/canvas/roster/rosterHooks", () => ({ useRosterStudentsQuery: () => ({}), useRosterGroupSetsQuery: () => ({}) }));
vi.mock("@/features/canvas/hooks/canvasModuleHooks", () => ({
  useCanvasModulesWithItemsQuery: () => ({ data: [{ id: 1, name: "04 - Rust", items: [{ type: "Page", page_url: "rust", title: "Rust" }] }], isFetching: false }),
}));
vi.mock("../../context/CalendarQuizQuestionsProvider", () => ({ useCalendarQuizQuestions: () => quizzes.questions }));
// the modules holding a page of each name, as the module lists have them
const modules = vi.hoisted(() => ({ ofRust: ["04 - Rust"] }));
vi.mock("@/features/local/modules/localCourseModuleHooks", () => ({ useModulesOfName: () => (_: string, name: string) => (name === "Rust" ? modules.ofRust : []) }));
// the course's files in Canvas, as Canvas lists them
vi.mock("@/features/canvas/services/files/canvasCourseFileService", async (original) => ({
  ...(await original<object>()),
  canvasCourseFileService: { getAll: async () => [studies] },
}));

/** The differences the module list shows for the page, once they have settled on `expected` (or the wait times out). */
const settlesOn = async (canvasBody: string, expected: string[], problem?: string) => {
  canvas.pageBody = canvasBody;
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useMarkdownItemStatusOf("page"), { wrapper });
  await waitFor(() => expect(result.current!(page, "04 - Rust").differences.map((d) => d.key)).toEqual(expected));
  expect(result.current!(page, "04 - Rust").problem).toBe(problem);
};

describe("a page that links to a course file, in the module list and on the calendar", () => {
  it("reads in sync when Canvas has what Update in Canvas sent: the link pointing at the file's Canvas copy", async () => {
    await settlesOn(sentBody, []);
  });
  it("reads as differing when Canvas's link points somewhere else", async () => {
    const elsewhere = sentBody.replace("209208898", "1");
    await settlesOn(elsewhere, ["description"]);
  });
});

describe("a page whose name another module's page has too", () => {
  it("is a problem in the module list and on the calendar: Canvas keeps one page per name", async () => {
    modules.ofRust = ["04 - Rust", "09 - Review"];
    await settlesOn(sentBody, [], 'Two page files are named "Rust" (in 04 - Rust, 09 - Review). Canvas keeps one page per name, so they would overwrite each other: rename all but one.'.replace("Two", "2"));
    modules.ofRust = ["04 - Rust"];
  });
});

describe("a quiz in the module list and on the calendar, its questions not fetched this time", () => {
  const quiz = { name: "Quiz 1", dueAt: "09/01/2026 09:00:00", description: "", shuffleAnswers: true, showCorrectAnswers: true, oneQuestionAtATime: false, allowedAttempts: 1, questions: [] };
  const canvasQuiz = { id: 7, title: "Quiz 1", description: "", due_at: "09/01/2026 09:00:00", shuffle_answers: true, show_correct_answers: true, one_question_at_a_time: false, allowed_attempts: 1, published: true };
  const statusNow = async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useMarkdownItemStatusOf("quiz"), { wrapper });
    await waitFor(() => expect(result.current).toBeDefined());
    return result.current!(quiz, "04 - Rust");
  };
  it("says its questions weren't checked, when they never were", async () => {
    localStorage.clear();
    quizzes.inCanvas = [canvasQuiz];
    quizzes.questions = {};
    expect((await statusNow()).unchecked).toBe("questions not checked yet");
  });
  it("is in sync, once its questions matched at a check and its file hasn't changed since", async () => {
    localStorage.clear();
    quizzes.inCanvas = [canvasQuiz];
    quizzes.questions = { "Quiz 1": [] };
    expect((await statusNow()).unchecked).toBeUndefined();
    quizzes.questions = {};
    expect((await statusNow()).unchecked).toBeUndefined();
  });
});
