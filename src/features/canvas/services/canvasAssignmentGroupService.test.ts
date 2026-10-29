import { describe, it, expect, vi } from "vitest";

vi.mock("@/services/axiosUtils", () => ({ axiosClient: { delete: vi.fn(), get: vi.fn() } }));
vi.mock("./canvasServiceUtils", () => ({ canvasApi: "https://test.instructure.com/api/v1" }));

const { canvasAssignmentGroupService } = await import("./canvasAssignmentGroupService");
const { axiosClient } = await import("@/services/axiosUtils");

describe("deleting an assignment group in Canvas", () => {
  it("moves its assignments to another group, so Canvas doesn't delete them", async () => {
    await canvasAssignmentGroupService.delete(42, 2, 1);
    expect(axiosClient.delete).toHaveBeenCalledWith(
      "https://test.instructure.com/api/v1/courses/42/assignment_groups/2",
      { params: { move_assignments_to: 1 } },
    );
  });

  it("deletes an empty group without a group to move to", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: { assignments: [] } });
    await canvasAssignmentGroupService.delete(42, 3);
    expect(axiosClient.delete).toHaveBeenLastCalledWith(
      "https://test.instructure.com/api/v1/courses/42/assignment_groups/3",
      { params: {} },
    );
  });

  it("refuses to delete a group with assignments without a group to move them to", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: { assignments: [{ id: 1 }, { id: 2 }] } });
    vi.mocked(axiosClient.delete).mockClear();
    await expect(canvasAssignmentGroupService.delete(42, 4)).rejects.toThrow(/2 assignments/);
    expect(axiosClient.delete).not.toHaveBeenCalled();
  });
});
