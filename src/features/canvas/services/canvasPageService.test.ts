import { describe, it, expect, vi, beforeEach } from "vitest";
import { canvasPageService } from "./canvasPageService";
import { axiosClient } from "@/services/axiosUtils";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";

vi.mock("@/services/axiosUtils", () => ({
  axiosClient: { get: vi.fn(), put: vi.fn() },
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
  markdownToHTMLSafe: () => "<p>schedule</p>",
}));

const api = "https://test.instructure.com/api/v1/courses/42";
const page = { name: "Course Schedule", text: "schedule", dueAt: "" };
const settings = {} as LocalCourseSettings;
const schedule = { page_id: 7, url: "course-schedule" };

const frontPage = (front: { url: string; body: string } | "none") =>
  vi
    .mocked(axiosClient.get)
    .mockImplementation(async () =>
      front === "none"
        ? Promise.reject({ response: { status: 404 } })
        : { data: front },
    );

describe("updating a page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fills its marker on the front page", async () => {
    frontPage({ url: "home", body: '<h2>Hi</h2><div id="embed-course-schedule"></div>' });

    await canvasPageService.update(42, schedule, page, settings);

    expect(axiosClient.put).toHaveBeenCalledWith(`${api}/front_page`, {
      wiki_page: {
        body: '<h2>Hi</h2><div id="embed-course-schedule"><p>schedule</p></div>',
      },
    });
  });

  it("writes only the page when the front page has no marker for it", async () => {
    frontPage({ url: "home", body: "<h2>Hi</h2>" });

    await canvasPageService.update(42, schedule, page, settings);

    expect(vi.mocked(axiosClient.put).mock.calls.map(([url]) => url)).toEqual([
      `${api}/pages/7`,
    ]);
  });

  it("works in a course without a front page", async () => {
    frontPage("none");

    await canvasPageService.update(42, schedule, page, settings);

    expect(vi.mocked(axiosClient.put).mock.calls.map(([url]) => url)).toEqual([
      `${api}/pages/7`,
    ]);
  });

  it("doesn't embed the front page in itself", async () => {
    frontPage({ url: "course-schedule", body: '<div id="embed-course-schedule"></div>' });

    await canvasPageService.update(42, schedule, page, settings);

    expect(vi.mocked(axiosClient.put).mock.calls.map(([url]) => url)).toEqual([
      `${api}/pages/7`,
    ]);
  });
});
