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
import { byPageId, remove, upsert } from "./cachedList";

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
      // Canvas answered with the page as it stored it: into the cached list
      // it goes, so the page shows as in Canvas at once
      queryClient.setQueryData(canvasPageKeys.pagesInCourse(settings.canvasId), upsert(byPageId, canvasPage));
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
      const publishSettings = await prepareImages([page.text]);
      // the module check doesn't depend on the page's content, so it runs
      // while Canvas saves the page
      const [updated] = await Promise.all([
        canvasPageService.update(
          settings.canvasId,
          canvasPage,
          page,
          publishSettings,
          canvasLinkTargets
        ),
        placeInModule(moduleName, {
          type: "Page",
          id: canvasPage.page_id,
          title: page.name,
          pageUrl: canvasPage.url,
        }),
      ]);
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
    onSuccess: (_data, canvasPageId) => {
      queryClient.setQueryData(canvasPageKeys.pagesInCourse(settings.canvasId), remove(byPageId, canvasPageId));
    },
  });
};

/** After the app changed a page in Canvas: reads that one back into the cached list. */
export const useRefreshCanvasPage = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  return async (canvasPageId: number) =>
    queryClient.setQueryData(
      canvasPageKeys.pagesInCourse(settings.canvasId),
      upsert(byPageId, await canvasPageService.get(settings.canvasId, canvasPageId)),
    );
};
