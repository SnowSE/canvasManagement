import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAddToCanvasModule,
  usePlaceInCanvasModule,
} from "./canvasModuleHooks";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { canvasPageService } from "../services/canvasPageService";
import { CanvasPage } from "../models/pages/canvasPageModel";
import { useCanvasLinkTargets } from "./useCanvasLinkTargets";
import { useCommitAfterPublish } from "@/features/local/git/gitHooks";
import { usePrepareImagesForCanvas } from "./usePrepareImagesForCanvas";

export const canvasPageKeys = {
  pagesInCourse: (courseCanvasId: number) => [
    "canvas",
    courseCanvasId,
    "pages",
  ],
};

export const useCanvasPagesQuery = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  return useQuery({
    queryKey: canvasPageKeys.pagesInCourse(settings.canvasId),
    queryFn: async () => await canvasPageService.getAll(settings.canvasId),
  });
};

export const useCreateCanvasPageMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const addToModule = useAddToCanvasModule();
  const canvasLinkTargets = useCanvasLinkTargets();
  const prepareImages = usePrepareImagesForCanvas();

  const commitAfterPublish = useCommitAfterPublish();

  return useMutation({
    mutationFn: async ({
      page,
      moduleName,
    }: {
      page: LocalCoursePage;
      moduleName: string;
    }) => {
      const publishSettings = await prepareImages([page.text]);
      const canvasPage = await canvasPageService.create(
        settings.canvasId,
        page,
        publishSettings,
        canvasLinkTargets
      );
      await addToModule(moduleName, {
        type: "Page",
        id: canvasPage.page_id,
        title: page.name,
        pageUrl: canvasPage.url,
      });
      return canvasPage;
    },
    onSuccess: (_data, variables) => {
      commitAfterPublish(`page "${variables.page.name}"`);
      queryClient.invalidateQueries({
        queryKey: canvasPageKeys.pagesInCourse(settings.canvasId),
      });
    },
  });
};

export const useUpdateCanvasPageMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const canvasLinkTargets = useCanvasLinkTargets();
  const prepareImages = usePrepareImagesForCanvas();
  const commitAfterPublish = useCommitAfterPublish();
  const placeInModule = usePlaceInCanvasModule();

  return useMutation({
    mutationFn: async ({
      page,
      canvasPage,
      moduleName,
    }: {
      page: LocalCoursePage;
      canvasPage: { page_id: number; url: string };
      moduleName: string;
    }) => {
      const updated = await canvasPageService.update(
        settings.canvasId,
        canvasPage,
        page,
        await prepareImages([page.text]),
        canvasLinkTargets
      );
      await placeInModule(moduleName, {
        type: "Page",
        id: canvasPage.page_id,
        title: page.name,
        pageUrl: canvasPage.url,
      });
      return updated;
    },
    onSuccess: (updated, variables) => {
      commitAfterPublish(`page "${variables.page.name}"`);
      // Canvas answered with the pages as it stored them: put those in the
      // cached list instead of downloading every page in the course again
      queryClient.setQueryData<CanvasPage[]>(
        canvasPageKeys.pagesInCourse(settings.canvasId),
        (pages) => pages && withReplaced(pages, updated)
      );
    },
  });
};

/** `pages` with each of `updated` in place of the page it replaces. */
export const withReplaced = (pages: CanvasPage[], updated: CanvasPage[]) =>
  pages.map((p) => updated.find((u) => u.page_id === p.page_id) ?? p);

export const useDeleteCanvasPageMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (canvasPageId: number) =>
      canvasPageService.delete(settings.canvasId, canvasPageId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: canvasPageKeys.pagesInCourse(settings.canvasId),
      });
    },
  });
};
