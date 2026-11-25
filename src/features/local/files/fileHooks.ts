"use client";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

/** A module's files (see LocalCourseFileListed), without their text. */
export const useFilesQueries = (moduleName: string) => {
  const { courseName } = useCourseContext();
  return useSuspenseQuery(useTRPC().file.getAll.queryOptions({ courseName, moduleName }));
};

export const useFileQuery = (moduleName: string, name: string) => {
  const { courseName } = useCourseContext();
  return useSuspenseQuery(useTRPC().file.get.queryOptions({ courseName, moduleName, name }));
};

/** Where previews find the course's files (see localFileUrl); undefined until the server has said. */
export const usePreviewBase = () => useQuery({ ...useTRPC().file.previewBase.queryOptions(), staleTime: Infinity }).data;

/** Every file of the course by its place in it, for a preview to find the files its links name. */
export const useCourseFilePathsQuery = () => {
  const { courseName } = useCourseContext();
  return useQuery(useTRPC().file.paths.queryOptions(courseName));
};

/** Every list a file can be in: a change to one file can change a module's files and the course's paths. */
const useInvalidateFiles = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // not waited for: a mutation is done when the file is written, not when every list has been read again
  return () => void queryClient.invalidateQueries({ queryKey: trpc.file.pathKey() });
};

export const useCreateFileMutation = () => useMutation(useTRPC().file.create.mutationOptions({ onSuccess: useInvalidateFiles() }));
/** Saving as you type: the file itself and its module's list (its hash), nothing wider. */
export const useSaveFileMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.file.save.mutationOptions({
      onSuccess: (_, { courseName, moduleName, name }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.file.getAll.queryKey({ courseName, moduleName }) });
        void queryClient.invalidateQueries({ queryKey: trpc.file.get.queryKey({ courseName, moduleName, name }) });
      },
    }),
  );
};
export const usePlaceFileMutation = () => useMutation(useTRPC().file.place.mutationOptions({ onSuccess: useInvalidateFiles() }));
export const useRemoveFileMutation = () => useMutation(useTRPC().file.remove.mutationOptions({ onSuccess: useInvalidateFiles() }));
