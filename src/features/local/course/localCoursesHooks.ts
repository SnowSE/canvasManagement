"use client";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import {
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

export const useLocalCoursesSettingsQuery = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.settings.allCoursesSettings.queryOptions());
};

export const useLocalCourseSettingsQuery = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.settings.courseSettings.queryOptions(courseName),
  );
};

/** How many code blocks in the course name each language; the editor's language guess leans on it. */
export const useCodeLanguagesQuery = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery({
    ...trpc.course.codeLanguages.queryOptions(courseName),
    // changes slowly, and a stale count only nudges a guess
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateLocalCourseMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.settings.createCourse.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.settings.allCoursesSettings.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.directories.getEmptyDirectories.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.globalSettings.getGlobalSettings.queryKey(),
        });
      },
    }),
  );
};

export const useUpdateLocalCourseSettingsMutation = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.settings.updateSettings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.settings.allCoursesSettings.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.settings.courseSettings.queryKey(courseName),
        });
      },
    }),
  );
};
