import { LocalAssignmentGroup } from "@/features/local/assignments/models/localAssignmentGroup";
import { CanvasAssignmentGroup } from "@/features/canvas/models/assignments/canvasAssignmentGroup";

type CanvasGroup = Pick<CanvasAssignmentGroup, "id" | "name" | "group_weight">;

/**
 * Syncing the assignment groups, matched by Canvas id or else name: a group only Canvas has is
 * added to the settings with Canvas's weight, a group only the settings have
 * is created in Canvas (`create`), and Canvas's weights become the
 * settings' (`updateWeight`). Nothing is deleted.
 */
export function syncAssignmentGroups(
  local: LocalAssignmentGroup[],
  canvas: CanvasGroup[],
  newId: () => string,
) {
  // by Canvas id once linked, else by name; each Canvas group matched once,
  // since Canvas allows two groups with one name
  const used = new Set<number>();
  const unused = (c: CanvasGroup) => !used.has(c.id);
  const matched = local.map((group): LocalAssignmentGroup => {
    const c =
      canvas.find((c) => unused(c) && c.id === group.canvasId) ??
      canvas.find((c) => unused(c) && c.name === group.name);
    if (!c) {
      const { canvasId: _gone, ...unlinked } = group;
      return unlinked;
    }
    used.add(c.id);
    return { ...group, canvasId: c.id };
  });
  const added = canvas
    .filter(unused)
    .map((c) => ({ id: newId(), name: c.name, weight: c.group_weight, canvasId: c.id }));
  const groups = [...matched, ...added];
  return {
    groups,
    added,
    create: groups.filter((g) => g.canvasId === undefined),
    updateWeight: groups.filter((g) => {
      const c = canvas.find((c) => c.id === g.canvasId);
      return c !== undefined && c.group_weight !== g.weight;
    }),
  };
}
