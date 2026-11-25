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
vi.mock("@/features/canvas/hooks/canvasQuizHooks", () => ({ useCanvasQuizzesQuery: () => ({ data: [] }) }));
vi.mock("@/features/canvas/hooks/canvasPageHooks", () => ({
  useCanvasPagesQuery: () => ({ data: [{ page_id: 1, url: "rust", title: "Rust", published: true, front_page: false, body: canvas.pageBody }] }),
}));
vi.mock("@/features/canvas/roster/rosterHooks", () => ({ useRosterStudentsQuery: () => ({}), useRosterGroupSetsQuery: () => ({}) }));
vi.mock("@/features/canvas/hooks/canvasModuleHooks", () => ({
  useCanvasModulesWithItemsQuery: () => ({ data: [{ id: 1, name: "04 - Rust", items: [{ type: "Page", page_url: "rust", title: "Rust" }] }], isFetching: false }),
}));
vi.mock("../../context/CalendarQuizQuestionsProvider", () => ({ useCalendarQuizQuestions: () => ({}) }));
// the course's files in Canvas, as Canvas lists them
vi.mock("@/features/canvas/services/files/canvasCourseFileService", async (original) => ({
  ...(await original<object>()),
  canvasCourseFileService: { getAll: async () => [studies] },
}));

/** The differences the module list shows for the page, once they have settled on `expected` (or the wait times out). */
const settlesOn = async (canvasBody: string, expected: string[]) => {
  canvas.pageBody = canvasBody;
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useMarkdownItemStatusOf("page"), { wrapper });
  await waitFor(() => expect(result.current!(page, "04 - Rust").differences.map((d) => d.key)).toEqual(expected));
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
