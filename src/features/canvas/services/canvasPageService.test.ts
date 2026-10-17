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
const embedded = { ...page, addToHome: true };
const settings = {} as LocalCourseSettings;
const schedule = { page_id: 7, url: "course-schedule" };

const frontPageInCanvas = (front: { url: string; body: string } | "none") =>
  vi
    .mocked(axiosClient.get)
    .mockImplementation(async () =>
      front === "none"
        ? Promise.reject({ response: { status: 404 } })
        : { data: front },
    );

const putUrls = () => vi.mocked(axiosClient.put).mock.calls.map(([url]) => url);

describe("updating a page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axiosClient.put).mockImplementation(async (url) => ({
      data: { url, stored: true },
    }));
  });

  it("returns the pages as Canvas stored them", async () => {
    frontPageInCanvas({ url: "home", body: "<h2>Hi</h2>" });

    expect(await canvasPageService.update(42, schedule, page, settings)).toEqual([
      { url: `${api}/pages/7`, stored: true },
    ]);
    expect(await canvasPageService.update(42, schedule, embedded, settings)).toEqual([
      { url: `${api}/pages/7`, stored: true },
      { url: `${api}/front_page`, stored: true },
    ]);
  });

  it("fills its marker on the front page with AddToHome: true", async () => {
    frontPageInCanvas({ url: "home", body: '<h2>Hi</h2><div id="embed-course-schedule"></div>' });

    await canvasPageService.update(42, schedule, embedded, settings);

    expect(axiosClient.put).toHaveBeenCalledWith(`${api}/front_page`, {
      wiki_page: {
        body: '<h2>Hi</h2><div id="embed-course-schedule"><p>schedule</p></div>',
      },
    });
  });

  it("doesn't read the front page without AddToHome", async () => {
    await canvasPageService.update(42, schedule, page, settings);

    expect(axiosClient.get).not.toHaveBeenCalled();
    expect(putUrls()).toEqual([`${api}/pages/7`]);
  });

  it("adds its marker at the end when the front page has none", async () => {
    frontPageInCanvas({ url: "home", body: "<h2>Hi</h2>" });

    await canvasPageService.update(42, schedule, embedded, settings);

    expect(axiosClient.put).toHaveBeenCalledWith(`${api}/front_page`, {
      wiki_page: { body: '<h2>Hi</h2><div id="embed-course-schedule"><p>schedule</p></div>' },
    });
  });

  it("empties its marker with AddToHome: false, keeping it in place", async () => {
    frontPageInCanvas({ url: "home", body: '<h2>Hi</h2><div id="embed-course-schedule"><p>old</p></div>' });

    await canvasPageService.update(42, schedule, { ...page, addToHome: false }, settings);

    expect(axiosClient.put).toHaveBeenCalledWith(`${api}/front_page`, {
      wiki_page: { body: '<h2>Hi</h2><div id="embed-course-schedule"></div>' },
    });
  });

  it("leaves a front page without its marker alone with AddToHome: false", async () => {
    frontPageInCanvas({ url: "home", body: "<h2>Hi</h2>" });

    await canvasPageService.update(42, schedule, { ...page, addToHome: false }, settings);

    expect(putUrls()).toEqual([`${api}/pages/7`]);
  });

  it("works in a course without a front page", async () => {
    frontPageInCanvas("none");

    await canvasPageService.update(42, schedule, embedded, settings);

    expect(putUrls()).toEqual([`${api}/pages/7`]);
  });

  it("doesn't embed the front page in itself", async () => {
    frontPageInCanvas({ url: "course-schedule", body: '<div id="embed-course-schedule"></div>' });

    await canvasPageService.update(42, schedule, embedded, settings);

    expect(putUrls()).toEqual([`${api}/pages/7`]);
  });
});
