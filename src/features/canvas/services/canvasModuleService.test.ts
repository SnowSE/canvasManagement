import { describe, it, expect, vi, beforeEach } from "vitest";
import { canvasModuleService } from "./canvasModuleService";
import { axiosClient } from "@/services/axiosUtils";
import { rateLimitAwarePost } from "./canvasWebRequestUtils";

vi.mock("@/services/axiosUtils", () => ({
  axiosClient: { get: vi.fn(), put: vi.fn() },
}));
vi.mock("./canvasWebRequestUtils", () => ({ rateLimitAwarePost: vi.fn() }));
vi.mock("./canvasServiceUtils", () => ({
  canvasApi: "https://test.instructure.com/api/v1",
  paginatedRequest: vi.fn(),
}));

const inModules = (...moduleIds: number[]) =>
  vi.mocked(axiosClient.get).mockResolvedValue({
    data: {
      items: moduleIds.map((module_id, i) => ({
        current: { id: 500 + i, module_id },
      })),
    },
  });

describe("placeInModule", () => {
  const quiz = { type: "Quiz" as const, id: 7, title: "Quiz 1" };
  beforeEach(() => vi.clearAllMocks());

  it("leaves an item alone when it is already in the module", async () => {
    inModules(3, 9);

    expect(await canvasModuleService.placeInModule(42, 9, quiz)).toBe("already");
    expect(axiosClient.put).not.toHaveBeenCalled();
    expect(rateLimitAwarePost).not.toHaveBeenCalled();
  });

  it("moves an item from another module", async () => {
    inModules(3);

    expect(await canvasModuleService.placeInModule(42, 9, quiz)).toBe("moved");
    expect(vi.mocked(axiosClient.put).mock.calls).toEqual([
      [
        "https://test.instructure.com/api/v1/courses/42/modules/3/items/500",
        { module_item: { module_id: 9 } },
      ],
    ]);
  });

  it("adds an item that is in no module", async () => {
    inModules();

    expect(await canvasModuleService.placeInModule(42, 9, quiz)).toBe("added");
    expect(vi.mocked(rateLimitAwarePost).mock.calls).toEqual([
      [
        "https://test.instructure.com/api/v1/courses/42/modules/9/items",
        { module_item: { title: "Quiz 1", type: "Quiz", content_id: 7 } },
      ],
    ]);
  });

  it("finds a page by its id and adds it by its url", async () => {
    inModules();

    await canvasModuleService.placeInModule(42, 9, {
      type: "Page",
      id: 12,
      title: "Schedule",
      pageUrl: "schedule",
    });
    expect(vi.mocked(axiosClient.get).mock.calls[0]).toEqual([
      "https://test.instructure.com/api/v1/courses/42/module_item_sequence",
      { params: { asset_type: "Page", asset_id: 12 } },
    ]);
    expect(vi.mocked(rateLimitAwarePost).mock.calls[0][1]).toEqual({
      module_item: { title: "Schedule", type: "Page", page_url: "schedule" },
    });
  });
});
