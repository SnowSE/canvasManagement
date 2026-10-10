import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { CourseItemType } from "@/features/local/course/courseItemTypes";

export const useInvalidItemsQuery = (moduleName: string) => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery(
    trpc.module.getInvalidItems.queryOptions({ courseName, moduleName }),
  );
};

/** Unparsable files in every module of the course, with dueAt when it reads. */
export const useInvalidItemsForCourseQuery = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery(trpc.module.getInvalidItemsForCourse.queryOptions(courseName));
};

export const useRawItemQuery = (
  moduleName: string,
  type: CourseItemType,
  name: string,
) => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery({
    ...trpc.module.getRawItem.queryOptions({ courseName, moduleName, type, name }),
    retry: false,
  });
};

/**
 * Saves a file's text as typed. Once it parses, the module's lists and the
 * item's own query are reset so the regular editor loads the fixed file.
 */
export const useSaveRawItemMutation = (
  moduleName: string,
  type: CourseItemType,
  name: string,
) => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.module.saveRawItem.mutationOptions({
      onSuccess: async ({ error }) => {
        // still broken, but the date line may have moved it on the calendar
        await queryClient.invalidateQueries({
          queryKey: trpc.module.getInvalidItemsForCourse.queryKey(courseName),
        });
        if (error) return;
        const moduleInput = { courseName, moduleName };
        const itemQueries = {
          Assignment: [
            trpc.assignment.getAllAssignments.queryKey(moduleInput),
            trpc.assignment.getAssignment.queryKey({ ...moduleInput, assignmentName: name }),
          ],
          Quiz: [
            trpc.quiz.getAllQuizzes.queryKey(moduleInput),
            trpc.quiz.getQuiz.queryKey({ ...moduleInput, quizName: name }),
          ],
          Page: [
            trpc.page.getAllPages.queryKey(moduleInput),
            trpc.page.getPage.queryKey({ ...moduleInput, pageName: name }),
          ],
        }[type];
        await Promise.all(
          itemQueries.map((queryKey) => queryClient.resetQueries({ queryKey })),
        );
        await queryClient.invalidateQueries({
          queryKey: trpc.module.getInvalidItems.queryKey(moduleInput),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.module.getRawItem.queryKey({ ...moduleInput, type, name }),
        });
      },
    }),
  );
};
