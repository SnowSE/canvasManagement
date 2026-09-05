"use client";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

// the server holds the cache, so the client never needs to refetch on its own
const cachedForever = { staleTime: Infinity, retry: false } as const;

export const useRosterStudentsQuery = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery(
    trpc.roster.students.queryOptions(courseName, cachedForever)
  );
};

export const useSyncRosterStudentsMutation = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.roster.syncStudents.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(
          trpc.roster.students.queryKey(courseName),
          data
        );
        toast.success(`${data.students.length} students loaded from Canvas`);
      },
      onError: (e) => toast.error(e.message),
    })
  );
};

export const useRosterGroupSetsQuery = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery(
    trpc.roster.groupSets.queryOptions(courseName, cachedForever)
  );
};

export const useSyncRosterGroupSetsMutation = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.roster.syncGroupSets.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(
          trpc.roster.groupSets.queryKey(courseName),
          data
        );
        toast.success(
          `${data.groupSets.length} group set${
            data.groupSets.length === 1 ? "" : "s"
          } loaded from Canvas`
        );
      },
      onError: (e) => toast.error(e.message),
    })
  );
};
