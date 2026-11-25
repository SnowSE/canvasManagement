import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useCommitAfterPublish } from "@/features/local/git/gitHooks";
import { canvasFileOf, sendingOf, withCanvasFiles } from "@/features/canvas/services/files/fileSyncStatus";
import { courseFilePath } from "@/services/courseFileLinks";
import { canvasCourseFileService } from "../services/files/canvasCourseFileService";
import { sentFiles } from "./sentFiles";

export const canvasFileKeys = {
  files: (canvasCourseId: number) => ["canvas", canvasCourseId, "files"],
};

export const canvasFilesQuery = (canvasCourseId: number) => ({
  queryKey: canvasFileKeys.files(canvasCourseId),
  queryFn: () => canvasCourseFileService.getAll(canvasCourseId),
});

export const useCanvasFilesQuery = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  return useQuery(canvasFilesQuery(settings.canvasId));
};

/**
 * The course's settings for comparing an item with Canvas: with the Canvas
 * address of each course file, so the item's links to files render as they
 * do when it is sent (see withCanvasFiles). Not for saving.
 */
export const useSettingsWithCanvasFiles = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasFiles } = useCanvasFilesQuery();
  // the same object while neither changes: comparisons are remembered by what they were made from
  return useMemo(() => withCanvasFiles(settings, canvasFiles), [settings, canvasFiles]);
};

/** After the app changed one of the course's files in Canvas: reads them again. */
export const useRefreshCanvasFiles = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  return () => queryClient.refetchQueries({ queryKey: canvasFileKeys.files(settings.canvasId) });
};

/**
 * Add to Canvas and Update in Canvas for one of the course's files, by its
 * place in the course: sends the file (see uploadCourseFile) to the
 * course's Canvas files, and to no module. Nothing else sends a file: an
 * item that links to one links to the copy Canvas already has.
 */
export const useSendFileToCanvasMutation = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: settings } = useLocalCourseSettingsQuery();
  const upload = useMutation(trpc.canvasFile.uploadCourseFile.mutationOptions());
  const commitAfterPublish = useCommitAfterPublish();

  return useMutation({
    mutationFn: async ({ path, hash }: { path: string; hash: string }) => {
      const name = path.split("/").pop()!;
      // Canvas's files as they are known now: sent before they are, a file Canvas has would be locked as new
      const canvasFiles = await queryClient.ensureQueryData(canvasFilesQuery(settings.canvasId));
      const id = await upload.mutateAsync({ courseName, path, ...sendingOf(path, canvasFiles, sentFiles.recall(settings.canvasId, path)) });
      sentFiles.remember(settings.canvasId, path, { id, hash });
      const files = await queryClient.fetchQuery({ ...canvasFilesQuery(settings.canvasId), staleTime: 0 });
      // the files it uses (a stylesheet beside it, another module's script) are sent on their own, like any file
      const used = await queryClient.fetchQuery({ ...trpc.file.used.queryOptions({ courseName, path }), staleTime: 0 });
      const missing = used.filter((u) => !canvasFileOf(u, files));
      if (missing.length)
        toast(`${name} uses ${missing.join(", ")}, not in Canvas yet: it will be incomplete there until ${missing.length === 1 ? "that file is" : "those files are"} added and published too.`, {
          icon: "⚠️",
          duration: 15000,
        });
    },
    onSuccess: (_, { path }) => commitAfterPublish(`file "${path}"`),
  });
};

/** Rename, as for any item: on disk and, where the file is in Canvas, there too (see renameCourseFile). */
export const useRenameFileMutation = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasFiles } = useCanvasFilesQuery();
  const rename = useMutation(trpc.canvasFile.renameCourseFile.mutationOptions());
  return async (moduleName: string, name: string, newName: string) => {
    const [from, to] = [courseFilePath(moduleName, name), courseFilePath(moduleName, newName)];
    await rename.mutateAsync({ courseName, moduleName, name, newName, canvasFileId: canvasFileOf(from, canvasFiles)?.id });
    sentFiles.move(settings.canvasId, from, to);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.file.pathKey() }),
      queryClient.invalidateQueries({ queryKey: canvasFileKeys.files(settings.canvasId) }),
    ]);
  };
};

export const useDeleteCanvasFileMutation = () => {
  const refreshFiles = useRefreshCanvasFiles();
  return useMutation({ mutationFn: canvasCourseFileService.delete, onSuccess: refreshFiles });
};
