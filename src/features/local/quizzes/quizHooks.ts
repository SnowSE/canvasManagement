"use client";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import {
  useSuspenseQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export const useQuizQuery = (moduleName: string, quizName: string) => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.quiz.getQuiz.queryOptions({
      courseName,
      moduleName,
      quizName,
    })
  );
};

/** The question banks a quiz's text names, read relative to the module's quizzes folder. */
export const useQuizBanksQuery = (moduleName: string, paths: string[]) => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery({
    ...trpc.quiz.getBanks.queryOptions({ courseName, moduleName, paths }),
    enabled: paths.length > 0,
  });
};

/** Every bank file in the course, as `<module>/banks/<file>`. */
export const useBankFilesQuery = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery(trpc.quiz.listBankFiles.queryOptions(courseName));
};

export const useQuizzesQueries = (moduleName: string) => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.quiz.getAllQuizzes.queryOptions({
      courseName,
      moduleName,
    })
  );
};

export const useUpdateQuizMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.quiz.updateQuiz.mutationOptions({
      onSuccess: (
        _,
        { courseName, moduleName, quizName, previousModuleName }
      ) => {
        if (moduleName !== previousModuleName) {
          queryClient.invalidateQueries({
            queryKey: trpc.quiz.getAllQuizzes.queryKey({
              courseName,
              moduleName: previousModuleName,
            }),
          });
        }
        queryClient.invalidateQueries({
          queryKey: trpc.quiz.getAllQuizzes.queryKey({
            courseName,
            moduleName,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.quiz.getQuiz.queryKey({
            courseName,
            moduleName,
            quizName,
          }),
        });
      },
    })
  );
};

export const useCreateQuizMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.quiz.createQuiz.mutationOptions({
      onSuccess: (_, { courseName, moduleName }) => {
        queryClient.invalidateQueries({
          queryKey: trpc.quiz.getAllQuizzes.queryKey({
            courseName,
            moduleName,
          }),
        });
      },
    })
  );
};

export const useDeleteQuizMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.quiz.deleteQuiz.mutationOptions({
      onSuccess: (_, { courseName, moduleName, quizName }) => {
        queryClient.invalidateQueries({
          queryKey: trpc.quiz.getAllQuizzes.queryKey({
            courseName,
            moduleName,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.quiz.getQuiz.queryKey({
            courseName,
            moduleName,
            quizName,
          }),
        });
      },
    })
  );
};
