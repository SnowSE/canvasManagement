"use client";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useFilesQueries, usePlaceFileMutation } from "@/features/local/files/fileHooks";
import { LocalCourseFileListed } from "@/features/local/files/localCourseFileModels";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { useCanvasFilesQuery, useDeleteCanvasFileMutation, useRefreshCanvasFiles, useSendFileToCanvasMutation } from "@/features/canvas/hooks/canvasCourseFileHooks";
import { canvasCourseFileService } from "@/features/canvas/services/files/canvasCourseFileService";
import { sentFiles } from "@/features/canvas/hooks/sentFiles";
import { canvasFileOf, fileSyncStatus } from "@/features/canvas/services/files/fileSyncStatus";
import { courseFilePath } from "@/services/courseFileLinks";
import { useCourseContext } from "../../../context/courseContext";
import { remembered } from "../../../calendar/day/useMarkdownItemStatus";
import { KindIcon } from "../../../itemIcons";
import { type ItemKindDef, unpublishedOnly } from "../../../itemKind";

export const FileIcon = () => (
  <KindIcon label="File" className="text-emerald-300/80">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" fill="currentColor" fillOpacity=".2" />
    <path d="M14 2v6h6" />
    <path d="m10 13-2 2 2 2M14 13l2 2-2 2" />
  </KindIcon>
);

/** A module's file as its list has it: an item with no day (`dueAt` empty), and what is known of the file itself. */
export type FileItem = IModuleItem & LocalCourseFileListed;

/**
 * What a file of a module's files folder is and does, for the pages that
 * show any item (see itemKinds): listed in its module with no day, and sent
 * to Canvas's files. It is not parsed from markdown, so it has no history.
 */
export const fileKind: ItemKindDef = {
  Icon: FileIcon,
  undated: {
    title: "Files",
    hint: "The files in this module's files folder. A file is on no day and in no Canvas module: link to it from a page, or right-click it to make a page for it.",
  },
  useModuleItems: (moduleName) => useFilesQueries(moduleName).data.map((file): FileItem => ({ ...file, dueAt: "" })),
  useStatusOf() {
    const { data: settings } = useLocalCourseSettingsQuery();
    const { data: canvasFiles } = useCanvasFilesQuery();
    if (!canvasFiles) return undefined;
    return (item, moduleName) => {
      const path = courseFilePath(moduleName, item.name);
      const canvasFile = canvasFileOf(path, canvasFiles);
      const { hash, size } = item as FileItem;
      return remembered(`${settings.name}/file/${path}`, [item, canvasFile], () => fileSyncStatus({ hash, size, canvasFile, sent: sentFiles.recall(settings.canvasId, path) }));
    };
  },
  useSendToCanvas() {
    const send = useSendFileToCanvasMutation();
    return ({ item, moduleName }) => send.mutateAsync({ path: courseFilePath(moduleName, item.name), hash: (item as FileItem).hash });
  },
  // a file is published by unlocking it
  usePublish: () => (id) => canvasCourseFileService.setLocked(id, false),
  useRefresh: useRefreshCanvasFiles,
  useRemoveUnpublished() {
    const { data: canvasFiles } = useCanvasFilesQuery();
    const remove = useDeleteCanvasFileMutation();
    return ({ item, moduleName }) => {
      const canvasFile = canvasFileOf(courseFilePath(moduleName, item.name), canvasFiles);
      return remove.mutateAsync(unpublishedOnly(canvasFile && { ...canvasFile, published: !canvasFile.locked }, item.name).id);
    };
  },
  // a file moves as it is: its text isn't in the lists, and isn't touched
  useSaveMoved() {
    const { courseName } = useCourseContext();
    const place = usePlaceFileMutation();
    const canvasId = useLocalCourseSettingsQuery().data.canvasId;
    return ({ name }, from, to) =>
      place.mutate(
        { courseName, from: { moduleName: from, name }, to: { moduleName: to, name } },
        // what this browser sent goes with it (once it has moved: a move can be refused), so Update in Canvas replaces the copy at its old place
        { onSuccess: () => sentFiles.move(canvasId, courseFilePath(from, name), courseFilePath(to, name)) },
      );
  },
};
