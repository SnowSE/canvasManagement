import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import {
  useCanvasModuleIdByName,
  usePlaceInCanvasModule,
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
  const moduleIdByName = useCanvasModuleIdByName();
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
      await canvasModuleService.addModuleItem(
        settings.canvasId,
        await moduleIdByName(moduleName),
        { type: "Assignment", id: canvasAssignmentId, title: assignment.name },
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
      await placeInModule(moduleName, {
        type: "Assignment",
        id: canvasAssignmentId,
        title: assignment.name,
      });
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
