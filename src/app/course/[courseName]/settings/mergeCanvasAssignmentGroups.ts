import { LocalAssignmentGroup } from "@/features/local/assignments/models/localAssignmentGroup";
import { CanvasAssignmentGroup } from "@/features/canvas/models/assignments/canvasAssignmentGroup";

/**
 * Pulling the assignment groups from Canvas: a group with the same name takes
 * Canvas's id and weight, a group only Canvas has is added, and a group only
 * the settings have stays (Update Assignment Groups In Canvas creates it).
 */
export function mergeCanvasAssignmentGroups(
  local: LocalAssignmentGroup[],
  canvas: Pick<CanvasAssignmentGroup, "id" | "name" | "group_weight">[],
  newId: () => string,
): LocalAssignmentGroup[] {
  const fromCanvas = (name: string) => canvas.find((c) => c.name === name);
  const merged = local.map((group) => {
    const c = fromCanvas(group.name);
    return c ? { ...group, weight: c.group_weight, canvasId: c.id } : group;
  });
  const added = canvas
    .filter((c) => !local.some((g) => g.name === c.name))
    .map((c) => ({ id: newId(), name: c.name, weight: c.group_weight, canvasId: c.id }));
  return [...merged, ...added];
}
