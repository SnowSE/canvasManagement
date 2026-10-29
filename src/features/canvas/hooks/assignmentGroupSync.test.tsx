// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

const deleteGroup = vi.fn(async () => {});

vi.mock("../services/canvasAssignmentGroupService", () => ({
  canvasAssignmentGroupService: {
    // Canvas has the settings' group, and a "Practice" group made in Canvas
    getAll: async () => [
      { id: 1, name: "Assignments", group_weight: 100 },
      { id: 2, name: "Practice", group_weight: 0 },
    ],
    delete: (...args: unknown[]) => deleteGroup(...(args as [])),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
// every assignment and quiz in "Practice" (and its submissions) goes with it
vi.mock("../services/canvasAssignmentService", () => ({
  canvasAssignmentService: {
    getAll: async () => [{ id: 900, name: "Practice quiz 1", assignment_group_id: 2 }],
  },
}));
const saved = vi.fn(async (settings: unknown) => settings);
vi.mock("@/features/local/course/localCoursesHooks", () => ({
  useUpdateLocalCourseSettingsMutation: () => ({ mutateAsync: saved }),
}));
vi.mock("@/services/serverFunctions/trpcClient", () => ({ useTRPC: () => ({}) }));
vi.mock("../services/canvasService", () => ({ canvasService: {} }));

import { useSyncAssignmentGroupsMutation } from "./canvasCourseHooks";

describe("Sync With Canvas (assignment groups)", () => {
  it("keeps a Canvas group the settings don't list, adding it to them, and deletes nothing", async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSyncAssignmentGroupsMutation(), { wrapper });

    await result.current.mutateAsync({
      canvasId: 100,
      assignmentGroups: [{ id: "a", name: "Assignments", weight: 100, canvasId: 1 }],
    } as never);

    expect(deleteGroup).not.toHaveBeenCalled();
    const settings = saved.mock.calls[0][0] as { assignmentGroups: { name: string; canvasId?: number }[] };
    expect(settings.assignmentGroups.map((g) => [g.name, g.canvasId])).toEqual([
      ["Assignments", 1],
      ["Practice", 2],
    ]);
  });
});
