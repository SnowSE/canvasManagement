import { describe, it, expect, vi, beforeEach } from "vitest";
import { answerIsWhole, canvasAssignmentService } from "./canvasAssignmentService";
import { axiosClient } from "@/services/axiosUtils";
import { paginatedRequest } from "./canvasServiceUtils";
import { rateLimitAwareDelete, rateLimitAwarePost } from "./canvasWebRequestUtils";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";

vi.mock("@/services/axiosUtils", () => ({
  axiosClient: { put: vi.fn(), get: vi.fn() },
}));
vi.mock("./canvasWebRequestUtils", () => ({
  rateLimitAwarePost: vi.fn(),
  rateLimitAwareDelete: vi.fn(),
}));
vi.mock("./canvasServiceUtils", () => ({
  canvasApi: "https://test.instructure.com/api/v1",
  paginatedRequest: vi.fn(),
}));
vi.mock("@/services/htmlMarkdownUtils", () => ({
  markdownToHTMLSafe: () => "<p>hello</p>",
}));

const assignment: LocalAssignment = {
  name: "Essay",
  description: "hello",
  dueAt: "09/16/2026 23:59:00",
  submissionTypes: [],
  allowedFileUploadExtensions: [],
  rubric: [],
};
const settings = {} as LocalCourseSettings;
// an extension given to one student in Canvas
const extension = { id: 9, student_ids: [100202], due_at: "2026-09-20T05:59:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axiosClient.put).mockResolvedValue({
    data: { id: 5, name: "Essay", has_overrides: true },
  });
  vi.mocked(paginatedRequest).mockResolvedValue([extension]);
  // the rubric's creation
  vi.mocked(rateLimitAwarePost).mockResolvedValue({ data: {} } as never);
});

describe("canvasAssignmentService.update", () => {
  it("leaves Canvas's student overrides alone when the file has no Schedule", async () => {
    const saved = await canvasAssignmentService.update(42, 5, assignment, settings);
    const { overridesChanged } = await canvasAssignmentService.syncRubricAndOverrides(42, saved, assignment, undefined);

    expect(rateLimitAwareDelete).not.toHaveBeenCalled();
    expect(overridesChanged).toBe(false);
  });

  it("replaces them with the Schedule's when the file has one", async () => {
    const scheduled = { title: "Scheduled 09/18/2026", student_ids: [100203], due_at: "2026-09-19T05:59:00Z" };

    const saved = await canvasAssignmentService.update(42, 5, assignment, settings);
    const { overridesChanged } = await canvasAssignmentService.syncRubricAndOverrides(42, saved, assignment, [scheduled]);

    expect(overridesChanged).toBe(true);
    expect(rateLimitAwareDelete).toHaveBeenCalledWith(
      "https://test.instructure.com/api/v1/courses/42/assignments/5/overrides/9"
    );
    expect(rateLimitAwarePost).toHaveBeenCalledWith(
      "https://test.instructure.com/api/v1/courses/42/assignments/5/overrides",
      { assignment_override: scheduled }
    );
  });
});

describe("canvasAssignmentService.syncRubricAndOverrides", () => {
  const rubricUrl = "https://test.instructure.com/api/v1/courses/42/rubrics";
  const saved = { id: 5, name: "Essay", has_overrides: false } as CanvasAssignment;

  it("re-creates the rubric and re-asserts the points", async () => {
    await canvasAssignmentService.syncRubricAndOverrides(42, saved, assignment, undefined);

    expect(rateLimitAwarePost).toHaveBeenCalledWith(rubricUrl, expect.anything());
    expect(axiosClient.put).toHaveBeenCalledTimes(1);
  });

  it("leaves a rubric Canvas already has as the file has it alone", async () => {
    await canvasAssignmentService.syncRubricAndOverrides(42, saved, assignment, undefined, { rubricUnchanged: true });

    expect(rateLimitAwarePost).not.toHaveBeenCalled();
    expect(axiosClient.put).not.toHaveBeenCalled();
  });
});

describe("answerIsWhole", () => {
  const nothingElse = { rubricUnchanged: true, overridesChanged: false, placed: "already" as const };
  it("spares the readback only when nothing else was sent and no overrides apply", () => {
    expect(answerIsWhole({ has_overrides: false }, nothingElse)).toBe(true);
    expect(answerIsWhole({ has_overrides: true }, nothingElse)).toBe(false);
    expect(answerIsWhole({ has_overrides: false }, { ...nothingElse, rubricUnchanged: false })).toBe(false);
    expect(answerIsWhole({ has_overrides: false }, { ...nothingElse, overridesChanged: true })).toBe(false);
    expect(answerIsWhole({ has_overrides: false }, { ...nothingElse, placed: "moved" })).toBe(false);
  });
});

describe("canvasAssignmentService.getAll", () => {
  it("reads each assignment's own dates, not the ones its overrides give students", async () => {
    vi.mocked(paginatedRequest).mockResolvedValue([]);

    await canvasAssignmentService.getAll(42);

    const { url } = vi.mocked(paginatedRequest).mock.calls[0][0] as { url: string };
    expect(new URL(url).searchParams.get("override_assignment_dates")).toBe("false");
    expect(new URL(url).searchParams.getAll("include[]")).toContain("overrides");
  });
});

describe("canvasAssignmentService.get", () => {
  it("reads one assignment the way getAll lists them: its own dates, overrides along, dates in local form", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: { id: 5, name: "HW", due_at: "2026-09-08T05:59:00Z", overrides: [] },
    });

    const assignment = await canvasAssignmentService.get(42, 5);

    const url = vi.mocked(axiosClient.get).mock.calls[0][0] as string;
    expect(url).toContain("/courses/42/assignments/5?");
    expect(new URL(url).searchParams.get("override_assignment_dates")).toBe("false");
    expect(new URL(url).searchParams.getAll("include[]")).toContain("overrides");
    expect(assignment.due_at).toBe(new Date("2026-09-08T05:59:00Z").toLocaleString());
  });
});
