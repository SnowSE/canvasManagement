"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { showActionNeededToast, showErrorToast } from "@/app/MyToaster";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { ItemKind } from "@/features/local/course/courseItemTypes";
import { baseCanvasUrl } from "@/features/canvas/services/canvasServiceUtils";
import { canvasCourseModuleKeys, useCanvasModulesQuery, useRefreshCanvasModules } from "@/features/canvas/hooks/canvasModuleHooks";
import { itemKinds, useEachKind } from "./itemKinds";

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
  const publishKind = useEachKind((kind) => kind.usePublish());
  const refreshKind = useEachKind((kind) => kind.useRefresh());
  // a kind with no day is in no Canvas module
  const canvasModuleOf = (type: ItemKind, moduleName: string) => (itemKinds[type].undated ? undefined : canvasModules?.find((m) => m.name === moduleName));

  return useMutation({
    mutationFn: async ({
      type,
      canvasItemId,
      moduleName,
    }: {
      type: ItemKind;
      canvasItemId: number;
      name: string;
      moduleName: string;
    }) => {
      await publishKind[type](canvasItemId);
      // the item's module shows it as published too
      const canvasModule = canvasModuleOf(type, moduleName);
      await Promise.all([
        refreshKind[type](canvasItemId),
        itemKinds[type].undated ? undefined : canvasModule ? refreshModules([canvasModule.id]) : queryClient.invalidateQueries({ queryKey: canvasCourseModuleKeys.modules(settings.canvasId) }),
      ]);
    },
    onSuccess: (_, { type, name, moduleName }) => {
      const canvasModule = canvasModuleOf(type, moduleName);
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
