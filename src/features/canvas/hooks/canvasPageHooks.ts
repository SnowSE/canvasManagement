import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAddToCanvasModule,
  usePlaceInCanvasModule,
} from "./canvasModuleHooks";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { canvasPageService } from "../services/canvasPageService";
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
      await canvasPageService.update(
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
    },
    onSuccess: (_data, variables) => {
      commitAfterPublish(`page "${variables.page.name}"`);
      queryClient.invalidateQueries({
        queryKey: canvasPageKeys.pagesInCourse(settings.canvasId),
      });
    },
  });
};

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
