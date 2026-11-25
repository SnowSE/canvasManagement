"use client";
import { createContext, ReactNode, useContext } from "react";
import { ItemKind } from "@/features/local/course/courseItemTypes";
import { useCanvasAssignmentsQuery } from "@/features/canvas/hooks/canvasAssignmentHooks";
import { useRosterGroupSetsQuery, useRosterStudentsQuery } from "@/features/canvas/roster/rosterHooks";
import { LocalAssignment, AssignmentScheduleEntry } from "@/features/local/assignments/models/localAssignment";
import { getScheduleEntryStatus } from "./getAssignmentSyncStatus";
import { remembered } from "./useMarkdownItemStatus";
import { CHECKING, statusesOf } from "../../itemKindRules";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useEachKind } from "../../itemKinds";

export type ItemType = ItemKind;

/**
 * How each item stands against Canvas, for the calendar and the module list:
 * `statusOf` and `ready` are the kinds' own word (see statusesOf), and
 * `scheduleStatusOf` compares one batch of an assignment's Schedule.
 */
function useSyncStatuses() {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasAssignments } = useCanvasAssignmentsQuery();
  const { data: rosterStudents } = useRosterStudentsQuery();
  const { data: rosterGroupSets } = useRosterGroupSetsQuery();
  const roster = { students: rosterStudents, groupSets: rosterGroupSets };
  const { ready, statusOf } = statusesOf(useEachKind((kind) => kind.useStatusOf()));

  const scheduleStatusOf = (assignment: LocalAssignment, entry: AssignmentScheduleEntry) => {
    if (!canvasAssignments) return CHECKING;
    const canvasAssignment = canvasAssignments.find((c) => c.name === assignment.name);
    return remembered(
      `${settings.name}/schedule/${assignment.name}/${entry.date}`,
      [assignment, canvasAssignment, rosterStudents, rosterGroupSets, entry],
      () => getScheduleEntryStatus(assignment, entry, canvasAssignment, roster),
    );
  };

  return { ready, statusOf, scheduleStatusOf };
}

const SyncStatusContext = createContext<ReturnType<typeof useSyncStatuses> | undefined>(undefined);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  return <SyncStatusContext.Provider value={useSyncStatuses()}>{children}</SyncStatusContext.Provider>;
}

export function useItemSyncStatus() {
  const statuses = useContext(SyncStatusContext);
  if (!statuses) throw new Error("useItemSyncStatus needs a SyncStatusProvider");
  return statuses;
}
