import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import {
  useAddCanvasModuleMutation,
  useCanvasModulesQuery,
} from "./canvasModuleHooks";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { canvasModuleService } from "../services/canvasModuleService";
import { canvasAssignmentService } from "../services/canvasAssignmentService";
import { showErrorToast } from "@/app/MyToaster";
import { useCanvasLinkTargets } from "./useCanvasLinkTargets";
import { useCommitAfterPublish } from "@/features/local/git/gitHooks";
import { useAssignmentPublishOptions } from "./useAssignmentPublishOptions";
import { usePrepareImagesForCanvas } from "./usePrepareImagesForCanvas";

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

export const useAddAssignmentToCanvasMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasModules } = useCanvasModulesQuery();
  const addModule = useAddCanvasModuleMutation();
  const queryClient = useQueryClient();
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
      if (!canvasModules) {
        // console.log("cannot add assignment until modules loaded");
        throw new Error("cannot add assignment until modules loaded");
      }

      const assignmentGroup = settings.assignmentGroups.find(
        (g) => g.name === assignment.localAssignmentGroupName,
      );

      const publishSettings = await prepareImages([assignment.description]);
      const canvasAssignmentId = await canvasAssignmentService.create(
        settings.canvasId,
        assignment,
        publishSettings,
        assignmentGroup?.canvasId,
        canvasLinkTargets,
        getPublishOptions(assignment),
      );
      const canvasModule = canvasModules.find((c) => c.name === moduleName);
      const moduleId = canvasModule
        ? canvasModule.id
        : await addModule.mutateAsync(moduleName);

      await canvasModuleService.createModuleItem(
        settings.canvasId,
        moduleId,
        assignment.name,
        "Assignment",
        canvasAssignmentId,
      );
    },
    onSuccess: (_data, variables) => {
      commitAfterPublish(`assignment "${variables.assignment.name}"`);
      queryClient.invalidateQueries({
        queryKey: canvasAssignmentKeys.assignments(settings.canvasId),
      });
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
  const canvasLinkTargets = useCanvasLinkTargets();
  const getPublishOptions = useAssignmentPublishOptions();
  const prepareImages = usePrepareImagesForCanvas();

  const commitAfterPublish = useCommitAfterPublish();

  return useMutation({
    mutationFn: async ({
      assignment,
      canvasAssignmentId,
    }: {
      assignment: LocalAssignment;
      canvasAssignmentId: number;
    }) => {
      const assignmentGroup = settings.assignmentGroups.find(
        (g) => g.name === assignment.localAssignmentGroupName,
      );
      const publishSettings = await prepareImages([assignment.description]);
      await canvasAssignmentService.update(
        settings.canvasId,
        canvasAssignmentId,
        assignment,
        publishSettings,
        assignmentGroup?.canvasId,
        canvasLinkTargets,
        getPublishOptions(assignment),
      );
    },
    onSuccess: (_data, variables) => {
      commitAfterPublish(`assignment "${variables.assignment.name}"`);
      queryClient.invalidateQueries({
        queryKey: canvasAssignmentKeys.assignments(settings.canvasId),
      });
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: canvasAssignmentKeys.assignments(settings.canvasId),
      });
    },
  });
};
