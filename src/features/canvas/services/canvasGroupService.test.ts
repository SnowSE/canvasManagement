import { describe, it, expect, vi } from "vitest";
import { canvasGroupService } from "./canvasGroupService";
import { paginatedRequest } from "./canvasServiceUtils";

vi.mock("./canvasServiceUtils", () => ({
  canvasApi: "https://test.instructure.com/api/v1",
  paginatedRequest: vi.fn(),
}));

describe("getGroupCategories", () => {
  // Canvas makes a course read-only for teachers once its term ends
  it("returns no group sets for a course Canvas won't list them for", async () => {
    vi.mocked(paginatedRequest).mockRejectedValue({ response: { status: 403 } });

    expect(await canvasGroupService.getGroupCategories(1)).toEqual([]);
  });

  it("still fails on other errors", async () => {
    vi.mocked(paginatedRequest).mockRejectedValue({ response: { status: 500 } });

    await expect(canvasGroupService.getGroupCategories(1)).rejects.toEqual({
      response: { status: 500 },
    });
  });
});
