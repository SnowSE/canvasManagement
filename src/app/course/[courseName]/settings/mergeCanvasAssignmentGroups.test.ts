import { describe, it, expect } from "vitest";
import { mergeCanvasAssignmentGroups } from "./mergeCanvasAssignmentGroups";

const canvas = (id: number, name: string, group_weight: number) => ({ id, name, group_weight });

describe("mergeCanvasAssignmentGroups", () => {
  it("takes Canvas's id and weight for a group it has by the same name", () => {
    const local = [{ id: "a", name: "Exams", weight: 25 }];
    expect(mergeCanvasAssignmentGroups(local, [canvas(2780993, "Exams", 30)], () => "new")).toEqual([
      { id: "a", name: "Exams", weight: 30, canvasId: 2780993 },
    ]);
  });

  it("adds a group only Canvas has, and keeps one only the settings have", () => {
    const local = [{ id: "a", name: "Labs", weight: 50 }];
    expect(mergeCanvasAssignmentGroups(local, [canvas(2811983, "Practice", 0)], () => "new")).toEqual([
      { id: "a", name: "Labs", weight: 50 },
      { id: "new", name: "Practice", weight: 0, canvasId: 2811983 },
    ]);
  });
});
