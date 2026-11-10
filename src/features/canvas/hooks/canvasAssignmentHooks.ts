import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireDatesInOrder } from "@/features/local/utils/timeUtils";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import {
  useAddToCanvasModule,
  usePlaceInCanvasModule,
} from "./canvasModuleHooks";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { canvasAssignmentService } from "../services/canvasAssignmentService";
import { assignmentModuleItem } from "../services/canvasModuleService";
import { showErrorToast } from "@/app/MyToaster";
import { useCanvasLinkTargets } from "./useCanvasLinkTargets";
import { useCommitAfterPublish } from "@/features/local/git/gitHooks";
import { useAssignmentPublishOptions } from "./useAssignmentPublishOptions";
import { usePrepareImagesForCanvas } from "./usePrepareImagesForCanvas";
import { byId, merge, remove, upsert } from "./cachedList";

export const canvasAssignmentKeys = {
  assignments: (canvasCourseId: number) =>
    ["canvas", canvasCourseId, "assignments"] as const,
};

export const useCanvasAssignmentsQuery = () => {
  const { data: settings } = useLocalCourseSettingsQuery();

  return useQuery({
    queryKey: canvasAssignmentKeys.assignments(settings.canvasId),
    queryFn: async () => canvasAssignmentService.getAll(settings.canvasId),
  });
};

/** After the app changed an assignment in Canvas: reads that one back into the cached list. */
export const useRefreshCanvasAssignment = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  return async (canvasAssignmentId: number) =>
    queryClient.setQueryData(
      canvasAssignmentKeys.assignments(settings.canvasId),
      upsert(byId, await canvasAssignmentService.get(settings.canvasId, canvasAssignmentId)),
    );
};

export const useAddAssignmentToCanvasMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const addToModule = useAddToCanvasModule();
  const refresh = useRefreshCanvasAssignment();
  const canvasLinkTargets = useCanvasLinkTargets();
  const getPublishOptions = useAssignmentPublishOptions();
  const prepareImages = usePrepareImagesForCanvas();

  const commitAfterPublish = useCommitAfterPublish();

  return useMutation({
    mutationFn: async ({
      assignment,
      moduleName,
    }: {
      assignment: LocalAssignment;
      moduleName: string;
    }) => {
      requireDatesInOrder(assignment);
      const assignmentGroup = settings.assignmentGroups.find(
        (g) => g.name === assignment.localAssignmentGroupName,
      );

      const publishSettings = await prepareImages([assignment.description]);
      const publishOptions = getPublishOptions(assignment);
      const saved = await canvasAssignmentService.create(
        settings.canvasId,
        assignment,
        publishSettings,
        assignmentGroup?.canvasId,
        canvasLinkTargets,
        publishOptions,
      );
      // Canvas's answer shows the item as in Canvas now; the rubric, the
      // overrides and the module follow, then the item is read back whole
      queryClient.setQueryData(canvasAssignmentKeys.assignments(settings.canvasId), upsert(byId, saved));
      await Promise.all([
        canvasAssignmentService.syncRubricAndOverrides(settings.canvasId, saved, assignment, publishOptions?.overrides),
        addToModule(moduleName, assignmentModuleItem(saved)),
      ]);
      await refresh(saved.id);
    },
    onSuccess: (_data, variables) => {
      commitAfterPublish(`assignment "${variables.assignment.name}"`);
    },
    onError: (error) => {
      console.error("Failed to add assignment to Canvas:", error);
      showErrorToast(error.message);
    },
  });
};

export const useUpdateAssignmentInCanvasMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const refresh = useRefreshCanvasAssignment();
  const canvasLinkTargets = useCanvasLinkTargets();
  const getPublishOptions = useAssignmentPublishOptions();
  const prepareImages = usePrepareImagesForCanvas();
  const placeInModule = usePlaceInCanvasModule();

  const commitAfterPublish = useCommitAfterPublish();

  return useMutation({
    mutationFn: async ({
      assignment,
      canvasAssignmentId,
      moduleName,
    }: {
      assignment: LocalAssignment;
      canvasAssignmentId: number;
      moduleName: string;
    }) => {
      requireDatesInOrder(assignment);
      const assignmentGroup = settings.assignmentGroups.find(
        (g) => g.name === assignment.localAssignmentGroupName,
      );
      const publishSettings = await prepareImages([assignment.description]);
      const publishOptions = getPublishOptions(assignment);
      const saved = await canvasAssignmentService.update(
        settings.canvasId,
        canvasAssignmentId,
        assignment,
        publishSettings,
        assignmentGroup?.canvasId,
        canvasLinkTargets,
        publishOptions,
      );
      // Canvas's answer colours the item now (over what the list had: the
      // answer leaves out its overrides); the rubric, the overrides and the
      // module follow, then the item is read back whole
      queryClient.setQueryData(canvasAssignmentKeys.assignments(settings.canvasId), merge(byId, saved));
      await Promise.all([
        canvasAssignmentService.syncRubricAndOverrides(settings.canvasId, saved, assignment, publishOptions?.overrides),
        placeInModule(moduleName, assignmentModuleItem(saved)),
      ]);
      await refresh(saved.id);
    },
    onSuccess: (_data, variables) => {
      commitAfterPublish(`assignment "${variables.assignment.name}"`);
    },
    onError: (error) => {
      console.error("Failed to update assignment in Canvas:", error);
      showErrorToast(error.message);
    },
  });
};

export const useDeleteAssignmentFromCanvasMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      canvasAssignmentId,
      assignmentName,
    }: {
      canvasAssignmentId: number;
      assignmentName: string;
    }) => {
      await canvasAssignmentService.delete(
        settings.canvasId,
        canvasAssignmentId,
        assignmentName,
      );
    },
    onSuccess: (_data, { canvasAssignmentId }) => {
      queryClient.setQueryData(
        canvasAssignmentKeys.assignments(settings.canvasId),
        remove(byId, canvasAssignmentId),
      );
    },
  });
};
