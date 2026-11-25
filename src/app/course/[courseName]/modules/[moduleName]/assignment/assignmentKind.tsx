"use client";
import { canvasAssignmentService } from "@/features/canvas/services/canvasAssignmentService";
import { useCourseContext } from "../../../context/courseContext";
import { useMarkdownItemStatusOf } from "../../../calendar/day/useMarkdownItemStatus";
import { AssignmentIcon } from "../../../itemIcons";
import { type ItemKindDef, unpublishedOnly } from "../../../itemKind";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { useAssignmentsQueries, useUpdateAssignmentMutation } from "@/features/local/assignments/assignmentHooks";
import {
  useAddAssignmentToCanvasMutation,
  useCanvasAssignmentsQuery,
  useRefreshCanvasAssignment,
  useDeleteAssignmentFromCanvasMutation,
  useUpdateAssignmentInCanvasMutation,
} from "@/features/canvas/hooks/canvasAssignmentHooks";

/** What an assignment is and does, for the pages that show any item (see itemKinds). */
export const assignmentKind: ItemKindDef = {
  Icon: AssignmentIcon,
  markdown: "Assignment",
  useModuleItems: (moduleName) => useAssignmentsQueries(moduleName).data ?? [],
  useStatusOf: () => useMarkdownItemStatusOf("assignment"),
  useSendToCanvas() {
    const { data: inCanvas } = useCanvasAssignmentsQuery();
    const add = useAddAssignmentToCanvasMutation();
    const update = useUpdateAssignmentInCanvasMutation();
    return ({ item, moduleName }) => {
      const assignment = item as LocalAssignment;
      const there = inCanvas?.find((a) => a.name === item.name);
      return there ? update.mutateAsync({ assignment, canvasAssignmentId: there.id, moduleName }) : add.mutateAsync({ assignment, moduleName });
    };
  },
  usePublish() {
    const { data: settings } = useLocalCourseSettingsQuery();
    return (id) => canvasAssignmentService.publish(settings.canvasId, id);
  },
  useRefresh: useRefreshCanvasAssignment,
  useRemoveUnpublished() {
    const { data: inCanvas } = useCanvasAssignmentsQuery();
    const remove = useDeleteAssignmentFromCanvasMutation();
    return ({ item }) =>
      remove.mutateAsync({ canvasAssignmentId: unpublishedOnly(inCanvas?.find((a) => a.name === item.name), item.name).id, assignmentName: item.name });
  },
  useSaveMoved() {
    const { courseName } = useCourseContext();
    const update = useUpdateAssignmentMutation();
    return (item, from, to) =>
      update.mutate({ courseName, moduleName: to, previousModuleName: from, assignment: item as LocalAssignment, assignmentName: item.name, previousAssignmentName: item.name });
  },
};
