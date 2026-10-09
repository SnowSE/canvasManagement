import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { showActionNeededToast, showErrorToast } from "@/app/MyToaster";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { baseCanvasUrl } from "../services/canvasServiceUtils";
import { canvasAssignmentService } from "../services/canvasAssignmentService";
import { canvasQuizService } from "../services/canvasQuizService";
import { canvasPageService } from "../services/canvasPageService";
import { canvasAssignmentKeys } from "./canvasAssignmentHooks";
import { canvasQuizKeys } from "./canvasQuizHooks";
import { canvasPageKeys } from "./canvasPageHooks";
import {
  canvasCourseModuleKeys,
  useCanvasModulesQuery,
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

  return useMutation({
    mutationFn: async ({
      type,
      canvasItemId,
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
    },
    onSuccess: (_, { type, name, moduleName }) => {
      queryClient.invalidateQueries({
        queryKey:
          type === "assignment"
            ? canvasAssignmentKeys.assignments(settings.canvasId)
            : type === "quiz"
              ? canvasQuizKeys.quizzes(settings.canvasId)
              : canvasPageKeys.pagesInCourse(settings.canvasId),
      });
      queryClient.invalidateQueries({
        queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
      });

      const canvasModule = canvasModules?.find((m) => m.name === moduleName);
      if (canvasModule && canvasModule.published === false) {
        showActionNeededToast(
          `Published "${name}", but its module "${moduleName}" is unpublished in Canvas, so students can't see it yet.`,
          `${baseCanvasUrl}/courses/${settings.canvasId}/modules`,
          "Open modules in Canvas",
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
