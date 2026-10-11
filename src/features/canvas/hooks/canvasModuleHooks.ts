import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { canvasModuleService } from "../services/canvasModuleService";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import toast from "react-hot-toast";

export const canvasCourseModuleKeys = {
  modules: (canvasId: number) => ["canvas", canvasId, "module list"] as const,
};

export const useCanvasModulesQuery = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  return useQuery({
    queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
    queryFn: async () =>
      await canvasModuleService.getCourseModules(settings.canvasId),
  });
};

export const useAddCanvasModuleMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (moduleName: string) =>
      await canvasModuleService.createModule(settings.canvasId, moduleName),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
      });
    },
  });
};

/**
 * For Update in Canvas: puts an item in the Canvas module named after its
 * folder, so moving a file to another module moves it in Canvas too.
 */
export const usePlaceInCanvasModule = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const addModule = useAddCanvasModuleMutation();
  return async (
    moduleName: string,
    item: Parameters<typeof canvasModuleService.placeInModule>[2]
  ) => {
    // loaded, not just cached, so a missing module isn't created twice
    const modules = await queryClient.ensureQueryData({
      queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
      queryFn: () => canvasModuleService.getCourseModules(settings.canvasId),
    });
    const moduleId =
      modules.find((m) => m.name === moduleName)?.id ??
      (await addModule.mutateAsync(moduleName));
    const placed = await canvasModuleService.placeInModule(
      settings.canvasId,
      moduleId,
      item
    );
    if (placed !== "already") {
      toast.success(
        `${placed === "moved" ? "Moved" : "Added"} "${item.title}" to the "${moduleName}" module in Canvas.`
      );
      queryClient.invalidateQueries({
        queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
      });
    }
    return placed;
  };
};

export const useReorderCanvasModuleItemsMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      moduleId,
      items,
    }: {
      moduleId: number;
      items: IModuleItem[];
    }) => {
      if (!settings?.canvasId) throw new Error("No canvasId in settings");

      const canvasModule = await canvasModuleService.getModuleWithItems(
        settings.canvasId,
        moduleId
      );
      if (!canvasModule.items) {
        throw new Error(
          "cannot sort canvas module items, no items found in module"
        );
      }
      const canvasItems = canvasModule.items;

      // Sort IModuleItems by dueAt
      const sorted = [...items].sort((a, b) => {
        const aDate = a.dueAt ? new Date(a.dueAt).getTime() : 0;
        const bDate = b.dueAt ? new Date(b.dueAt).getTime() : 0;
        return aDate - bDate;
      });

      // Map sorted IModuleItems to CanvasModuleItem ids by matching name/title
      const orderedIds = sorted
        .map((localItem) => canvasItems.find((canvasItem) => canvasItem.title === localItem.name)?.id)
        .filter((id): id is number => typeof id === "number");

      return await canvasModuleService.reorderModuleItems(
        settings.canvasId,
        moduleId,
        orderedIds
      );
    },
    onSuccess: (_data) => {
      if (!settings?.canvasId) return;
      queryClient.invalidateQueries({
        queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
      });
    },
  });
};
