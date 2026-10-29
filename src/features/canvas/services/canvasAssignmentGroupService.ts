import { canvasApi, paginatedRequest } from "./canvasServiceUtils";
import { CanvasAssignmentGroup } from "@/features/canvas/models/assignments/canvasAssignmentGroup";
import { LocalAssignmentGroup } from "@/features/local/assignments/models/localAssignmentGroup";
import { rateLimitAwarePost } from "./canvasWebRequestUtils";
import { axiosClient } from "@/services/axiosUtils";

export const canvasAssignmentGroupService = {
  async getAll(courseId: number): Promise<CanvasAssignmentGroup[]> {
    console.log("Requesting assignment groups");
    const url = `${canvasApi}/courses/${courseId}/assignment_groups`;
    const assignmentGroups = await paginatedRequest<CanvasAssignmentGroup[]>({
      url,
    });
    return assignmentGroups.flatMap((groupList) => groupList);
  },

  async create(
    canvasCourseId: number,
    localAssignmentGroup: LocalAssignmentGroup
  ): Promise<LocalAssignmentGroup> {
    console.log(`Creating assignment group: ${localAssignmentGroup.name}`);
    const url = `${canvasApi}/courses/${canvasCourseId}/assignment_groups`;
    const body = {
      name: localAssignmentGroup.name,
      group_weight: localAssignmentGroup.weight,
    };

    const { data: canvasAssignmentGroup } =
      await rateLimitAwarePost<CanvasAssignmentGroup>(url, body);

    return {
      ...localAssignmentGroup,
      canvasId: canvasAssignmentGroup.id,
    };
  },

  async update(
    canvasCourseId: number,
    localAssignmentGroup: LocalAssignmentGroup
  ): Promise<void> {
    console.log(
      `Updating assignment group: ${localAssignmentGroup.name}, ${localAssignmentGroup.canvasId}`
    );
    if (!localAssignmentGroup.canvasId) {
      throw new Error("Cannot update assignment group if canvas ID is null");
    }
    const url = `${canvasApi}/courses/${canvasCourseId}/assignment_groups/${localAssignmentGroup.canvasId}`;
    const body = {
      name: localAssignmentGroup.name,
      group_weight: localAssignmentGroup.weight,
    };

    await axiosClient.put(url, body);
  },

  /** How many assignments (quizzes included) each Canvas group holds, by its id. */
  async assignmentCounts(courseId: number): Promise<Record<number, number>> {
    const groups = await paginatedRequest<CanvasAssignmentGroup[]>({
      url: `${canvasApi}/courses/${courseId}/assignment_groups?include[]=assignments`,
    });
    return Object.fromEntries(
      groups.flat().map((g) => [g.id, g.assignments?.length ?? 0])
    );
  },

  /**
   * Deletes a group, moving its assignments to `moveAssignmentsTo`. Canvas
   * would delete them otherwise, so without one only an empty group is
   * deleted.
   */
  async delete(
    canvasCourseId: number,
    canvasAssignmentGroupId: number,
    moveAssignmentsTo?: number
  ): Promise<void> {
    const url = `${canvasApi}/courses/${canvasCourseId}/assignment_groups/${canvasAssignmentGroupId}`;
    if (moveAssignmentsTo === undefined) {
      const { data } = await axiosClient.get<CanvasAssignmentGroup>(url, {
        params: { include: ["assignments"] },
      });
      const count = data.assignments?.length ?? 0;
      if (count > 0)
        throw new Error(
          `${data.name ?? "The group"} has ${count} assignments in Canvas; pick a group to move them to`
        );
    }
    await axiosClient.delete(url, {
      params:
        moveAssignmentsTo === undefined
          ? {}
          : { move_assignments_to: moveAssignmentsTo },
    });
  },
};
