"use client";
import { canvasPageService } from "@/features/canvas/services/canvasPageService";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useCourseContext } from "../../../context/courseContext";
import { useMarkdownItemStatusOf } from "../../../calendar/day/useMarkdownItemStatus";
import { PageIcon } from "../../../itemIcons";
import { type ItemKindDef, unpublishedOnly } from "../../../itemKind";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { usePagesQueries, useUpdatePageMutation } from "@/features/local/pages/pageHooks";
import {
  useCanvasPagesQuery,
  useRefreshCanvasPage,
  useCreateCanvasPageMutation,
  useDeleteCanvasPageMutation,
  useUpdateCanvasPageMutation,
} from "@/features/canvas/hooks/canvasPageHooks";

/** What a page is and does, for the pages that show any item (see itemKinds). */
export const pageKind: ItemKindDef = {
  Icon: PageIcon,
  markdown: "Page",
  useModuleItems: (moduleName) => usePagesQueries(moduleName).data,
  useStatusOf: () => useMarkdownItemStatusOf("page"),
  useSendToCanvas() {
    const { data: inCanvas } = useCanvasPagesQuery();
    const add = useCreateCanvasPageMutation();
    const update = useUpdateCanvasPageMutation();
    return ({ item, moduleName }) => {
      const page = item as LocalCoursePage;
      const there = inCanvas?.find((p) => p.title === item.name);
      return there ? update.mutateAsync({ page, canvasPage: there, moduleName }) : add.mutateAsync({ page, moduleName });
    };
  },
  usePublish() {
    const { data: settings } = useLocalCourseSettingsQuery();
    return (id) => canvasPageService.publish(settings.canvasId, id);
  },
  useRefresh: useRefreshCanvasPage,
  useRemoveUnpublished() {
    const { data: inCanvas } = useCanvasPagesQuery();
    const remove = useDeleteCanvasPageMutation();
    return ({ item }) => remove.mutateAsync(unpublishedOnly(inCanvas?.find((p) => p.title === item.name), item.name).page_id);
  },
  useSaveMoved() {
    const { courseName } = useCourseContext();
    const update = useUpdatePageMutation();
    return (item, from, to) => update.mutate({ courseName, moduleName: to, previousModuleName: from, page: item as LocalCoursePage, pageName: item.name, previousPageName: item.name });
  },
};
