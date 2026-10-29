import { describe, it, expect } from "vitest";
import { syncAssignmentGroups } from "./syncAssignmentGroups";

const canvas = (id: number, name: string, group_weight: number) => ({ id, name, group_weight });

describe("syncAssignmentGroups", () => {
  it("never deletes: a group only Canvas has is added to the settings with its weight", () => {
    const local = [{ id: "a", name: "Labs", weight: 50, canvasId: 1 }];
    const plan = syncAssignmentGroups(local, [canvas(1, "Labs", 50), canvas(2, "Practice", 0)], () => "new");
    expect(plan.groups).toEqual([
      { id: "a", name: "Labs", weight: 50, canvasId: 1 },
      { id: "new", name: "Practice", weight: 0, canvasId: 2 },
    ]);
    expect(plan.added).toEqual([{ id: "new", name: "Practice", weight: 0, canvasId: 2 }]);
    expect(plan.create).toEqual([]);
    expect(plan.updateWeight).toEqual([]);
  });

  it("creates a group only the settings have, and pushes the settings' weights", () => {
    const local = [
      { id: "a", name: "Labs", weight: 40 },
      { id: "b", name: "Exams", weight: 60 },
    ];
    const plan = syncAssignmentGroups(local, [canvas(1, "Labs", 50)], () => "new");
    expect(plan.groups[0]).toEqual({ id: "a", name: "Labs", weight: 40, canvasId: 1 });
    expect(plan.updateWeight).toEqual([{ id: "a", name: "Labs", weight: 40, canvasId: 1 }]);
    expect(plan.create).toEqual([{ id: "b", name: "Exams", weight: 60 }]);
  });

  it("keeps groups Canvas has twice under one name apart, by their ids", () => {
    const fromCanvas = [canvas(1, "Assignments", 50), canvas(2, "Assignments", 0)];
    const first = syncAssignmentGroups([], fromCanvas, () => "new");
    expect(first.groups.map((g) => g.canvasId)).toEqual([1, 2]);

    const again = syncAssignmentGroups(
      [
        { id: "a", name: "Assignments", weight: 50, canvasId: 2 },
        { id: "b", name: "Assignments", weight: 0, canvasId: 1 },
      ],
      fromCanvas,
      () => "new",
    );
    expect(again.added).toEqual([]);
    expect(again.updateWeight.map((g) => g.canvasId)).toEqual([2, 1]);
  });

  it("creates again a group whose Canvas id Canvas no longer has", () => {
    const plan = syncAssignmentGroups([{ id: "a", name: "Labs", weight: 10, canvasId: 9 }], [], () => "new");
    expect(plan.create).toEqual([{ id: "a", name: "Labs", weight: 10 }]);
  });
});
