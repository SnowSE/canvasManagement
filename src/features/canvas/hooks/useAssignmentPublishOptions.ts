"use client";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { scheduleToOverrides } from "@/features/local/assignments/models/utils/scheduleUtils";
import {
  useRosterGroupSetsQuery,
  useRosterStudentsQuery,
} from "@/features/canvas/roster/rosterHooks";
import { useCallback } from "react";
import { CanvasAssignmentPublishOptions } from "../services/canvasAssignmentService";

/**
 * Turns an assignment's GroupSet / GradeIndividually / Schedule into Canvas ids.
 * Throws a readable error when the file names something Canvas does not have,
 * so publishing stops instead of silently dropping the setting.
 */
export const useAssignmentPublishOptions = () => {
  const { data: roster } = useRosterStudentsQuery();
  const { data: groupSetsData } = useRosterGroupSetsQuery();

  return useCallback(
    (assignment: LocalAssignment): CanvasAssignmentPublishOptions => {
      const options: CanvasAssignmentPublishOptions = {};

      if (assignment.groupSet) {
        if (!groupSetsData)
          throw new Error(
            "Group sets have not loaded from Canvas yet, try again in a moment"
          );
        const groupSet = groupSetsData.groupSets.find(
          (g) => g.name.toLowerCase() === assignment.groupSet!.toLowerCase()
        );
        if (!groupSet)
          throw new Error(
            `Group set "${assignment.groupSet}" is not in Canvas. Create it in Canvas, then sync groups in course settings.`
          );
        options.groupCategoryId = groupSet.id;
        options.gradeIndividually = assignment.gradeIndividually ?? false;
      }

      if (assignment.schedule && assignment.schedule.length > 0) {
        if (!roster)
          throw new Error(
            "The student roster has not loaded from Canvas yet, try again in a moment"
          );
        const { overrides, unknown, duplicates } = scheduleToOverrides(
          assignment,
          roster.students
        );
        if (unknown.length > 0)
          throw new Error(
            `Schedule names not in the Canvas roster: ${unknown.join(", ")}`
          );
        if (duplicates.length > 0)
          throw new Error(
            `Schedule lists these students more than once: ${duplicates.join(", ")}`
          );
        options.overrides = overrides;
      }

      return options;
    },
    [groupSetsData, roster]
  );
};
