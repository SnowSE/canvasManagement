import { describe, it, expect, vi, beforeEach } from "vitest";
import { canvasAssignmentService } from "./canvasAssignmentService";
import { axiosClient } from "@/services/axiosUtils";
import { paginatedRequest } from "./canvasServiceUtils";
import { rateLimitAwareDelete, rateLimitAwarePost } from "./canvasWebRequestUtils";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";

vi.mock("@/services/axiosUtils", () => ({
  axiosClient: { put: vi.fn() },
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
  // the rubric every update re-creates
  vi.mocked(rateLimitAwarePost).mockResolvedValue({ data: {} } as never);
});

describe("canvasAssignmentService.update", () => {
  it("leaves Canvas's student overrides alone when the file has no Schedule", async () => {
    await canvasAssignmentService.update(42, 5, assignment, settings);

    expect(rateLimitAwareDelete).not.toHaveBeenCalled();
  });

  it("replaces them with the Schedule's when the file has one", async () => {
    const scheduled = { title: "Scheduled 09/18/2026", student_ids: [100203], due_at: "2026-09-19T05:59:00Z" };

    await canvasAssignmentService.update(42, 5, assignment, settings, undefined, undefined, {
      overrides: [scheduled],
    });

    expect(rateLimitAwareDelete).toHaveBeenCalledWith(
      "https://test.instructure.com/api/v1/courses/42/assignments/5/overrides/9"
    );
    expect(rateLimitAwarePost).toHaveBeenCalledWith(
      "https://test.instructure.com/api/v1/courses/42/assignments/5/overrides",
      { assignment_override: scheduled }
    );
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
