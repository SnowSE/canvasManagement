import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  canvasModuleService,
  canvasModuleNames,
  ModuleItemContent,
} from "../services/canvasModuleService";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import toast from "react-hot-toast";
import { useMemo } from "react";

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

/** Every Canvas module with its items, for finding which modules hold an item. */
export const useCanvasModulesWithItemsQuery = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  return useQuery({
    // under the module list's key, so whatever refreshes the list refreshes this
    queryKey: [...canvasCourseModuleKeys.modules(settings.canvasId), "items"],
    queryFn: () =>
      canvasModuleService.getCourseModulesWithItems(settings.canvasId),
  });
};

/**
 * For comparing an item's module: the names of the Canvas modules holding it,
 * undefined while they load or when the item isn't in Canvas.
 */
export const useCanvasModuleNames = (
  type: Parameters<typeof canvasModuleNames>[1],
  canvasItem: Parameters<typeof canvasModuleNames>[2] | undefined
) => {
  const { data: modules, refetch } = useCanvasModulesWithItemsQuery();
  const names = useMemo(
    () => modules && canvasItem && canvasModuleNames(modules, type, canvasItem),
    [modules, type, canvasItem]
  );
  return { names, refetch };
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
 * Finds a Canvas module's id by name, creating the module if Canvas has none.
 * Loads the module list first (not just whatever is cached), so a missing
 * module isn't created twice.
 */
export const useCanvasModuleIdByName = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const addModule = useAddCanvasModuleMutation();
  return async (moduleName: string) => {
    const modules = await queryClient.ensureQueryData({
      queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
      queryFn: () => canvasModuleService.getCourseModules(settings.canvasId),
    });
    return (
      modules.find((m) => m.name === moduleName)?.id ??
      (await addModule.mutateAsync(moduleName))
    );
  };
};

/** For Add to Canvas: adds a new item to the module named after its folder. */
export const useAddToCanvasModule = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const moduleIdByName = useCanvasModuleIdByName();
  return async (moduleName: string, item: ModuleItemContent) => {
    await canvasModuleService.addModuleItem(
      settings.canvasId,
      await moduleIdByName(moduleName),
      item
    );
    queryClient.invalidateQueries({
      queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
    });
  };
};

/**
 * For Update in Canvas: makes the Canvas module named after an item's folder
 * the only one holding it, so moving a file to another module moves it in
 * Canvas too.
 */
export const usePlaceInCanvasModule = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const moduleIdByName = useCanvasModuleIdByName();
  return async (moduleName: string, item: ModuleItemContent) => {
    const { placed, removed } = await canvasModuleService.placeInModule(
      settings.canvasId,
      await moduleIdByName(moduleName),
      item
    );
    const changes = [
      placed === "moved" && `moved it to the "${moduleName}" module`,
      placed === "added" && `added it to the "${moduleName}" module`,
      removed > 0 &&
        `removed it from ${removed} other module${removed === 1 ? "" : "s"}`,
    ].filter(Boolean);
    if (changes.length > 0) {
      toast.success(`In Canvas, ${changes.join(" and ")}: "${item.title}".`);
      queryClient.invalidateQueries({
        queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
      });
    }
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
