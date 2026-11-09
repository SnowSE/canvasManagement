import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { showActionNeededToast, showErrorToast } from "@/app/MyToaster";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { baseCanvasUrl } from "../services/canvasServiceUtils";
import { canvasAssignmentService } from "../services/canvasAssignmentService";
import { canvasQuizService } from "../services/canvasQuizService";
import { canvasPageService } from "../services/canvasPageService";
import { useRefreshCanvasAssignment } from "./canvasAssignmentHooks";
import { useRefreshCanvasQuiz } from "./canvasQuizHooks";
import { useRefreshCanvasPage } from "./canvasPageHooks";
import {
  canvasCourseModuleKeys,
  useCanvasModulesQuery,
  useRefreshCanvasModules,
} from "./canvasModuleHooks";

export type PublishableItemType = "assignment" | "quiz" | "page";

/**
 * Publishes an item that is already in Canvas. Only the item: if its module
 * is still unpublished, students can't see it yet, so that gets an
 * action-needed toast instead of quietly publishing the whole module (which
 * in Canvas can publish everything else in it too).
 */
export const usePublishInCanvasMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasModules } = useCanvasModulesQuery();
  const queryClient = useQueryClient();
  const refreshModules = useRefreshCanvasModules();
  const refresh = {
    assignment: useRefreshCanvasAssignment(),
    quiz: useRefreshCanvasQuiz(),
    page: useRefreshCanvasPage(),
  };

  return useMutation({
    mutationFn: async ({
      type,
      canvasItemId,
      moduleName,
    }: {
      type: PublishableItemType;
      canvasItemId: number;
      name: string;
      moduleName: string;
    }) => {
      if (type === "assignment")
        await canvasAssignmentService.publish(settings.canvasId, canvasItemId);
      else if (type === "quiz")
        await canvasQuizService.publish(settings.canvasId, canvasItemId);
      else await canvasPageService.publish(settings.canvasId, canvasItemId);
      // the item's module shows it as published too
      const canvasModule = canvasModules?.find((m) => m.name === moduleName);
      await Promise.all([
        refresh[type](canvasItemId),
        canvasModule
          ? refreshModules([canvasModule.id])
          : queryClient.invalidateQueries({
              queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
            }),
      ]);
    },
    onSuccess: (_, { name, moduleName }) => {
      const canvasModule = canvasModules?.find((m) => m.name === moduleName);
      if (canvasModule && canvasModule.published === false) {
        showActionNeededToast(
          `Published "${name}", but its module "${moduleName}" is unpublished in Canvas, so students can't see it yet.`,
          // Canvas opens its modules page scrolled to this one
          `${baseCanvasUrl}/courses/${settings.canvasId}/modules/${canvasModule.id}`,
          `Open "${moduleName}" in Canvas`,
        );
      } else {
        toast.success(`Published "${name}" in Canvas`);
      }
    },
    onError: (error) => {
      console.error("Failed to publish in Canvas:", error);
      showErrorToast(error.message);
    },
  });
};
