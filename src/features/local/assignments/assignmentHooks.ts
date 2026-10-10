"use client";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

export const useAssignmentQuery = (
  moduleName: string,
  assignmentName: string,
) => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.assignment.getAssignment.queryOptions({
      moduleName,
      courseName,
      assignmentName,
    }),
  );
};

export const useAssignmentNamesQuery = (moduleName: string) => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useSuspenseQuery({
    ...trpc.assignment.getAllAssignments.queryOptions({
      moduleName,
      courseName,
    }),
    select: (assignments) => assignments.map((a) => a.name),
  });
};

export const useUpdateAssignmentMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.assignment.updateAssignment.mutationOptions({
      onSuccess: (
        _,
        {
          courseName,
          moduleName,
          assignmentName,
          previousAssignmentName,
          previousModuleName,
        },
      ) => {
        if (moduleName !== previousModuleName) {
          queryClient.invalidateQueries({
            queryKey: trpc.assignment.getAllAssignments.queryKey({
              courseName,
              moduleName: previousModuleName,
            }),
          });
        }
        queryClient.invalidateQueries({
          queryKey: trpc.assignment.getAllAssignments.queryKey({
            courseName,
            moduleName,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.assignment.getAssignment.queryKey({
            courseName,
            moduleName,
            assignmentName,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.assignment.getAssignment.queryKey({
            courseName,
            moduleName,
            assignmentName: previousAssignmentName,
          }),
        });
      },
    }),
  );
};

export const useCreateAssignmentMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.assignment.createAssignment.mutationOptions({
      onSuccess: (_result, { courseName, moduleName }) => {
        queryClient.invalidateQueries({
          queryKey: trpc.assignment.getAllAssignments.queryKey({
            courseName,
            moduleName,
          }),
        });
      },
    }),
  );
};

export const useDeleteAssignmentMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.assignment.deleteAssignment.mutationOptions({
      onSuccess: (_result, { courseName, moduleName, assignmentName }) => {
        queryClient.invalidateQueries({
          queryKey: trpc.assignment.getAllAssignments.queryKey({
            courseName,
            moduleName,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.assignment.getAssignment.queryKey({
            courseName,
            moduleName,
            assignmentName,
          }),
        });
      },
    }),
  );
};
