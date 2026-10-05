import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAddCanvasModuleMutation,
  useCanvasModulesQuery,
} from "./canvasModuleHooks";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { canvasModuleService } from "../services/canvasModuleService";
import { canvasQuizService } from "../services/canvasQuizService";
import { useCanvasLinkTargets } from "./useCanvasLinkTargets";
import toast from "react-hot-toast";
import { showErrorToast } from "@/app/MyToaster";

export const canvasQuizKeys = {
  quizzes: (canvasCourseId: number) =>
    ["canvas", canvasCourseId, "quizzes"] as const,
};

export const useCanvasQuizzesQuery = () => {
  const { data: settings } = useLocalCourseSettingsQuery();

  return useQuery({
    queryKey: canvasQuizKeys.quizzes(settings.canvasId),
    queryFn: async () => canvasQuizService.getAll(settings.canvasId),
  });
};

export const useAddQuizToCanvasMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const { data: canvasModules } = useCanvasModulesQuery();
  const addModule = useAddCanvasModuleMutation();
  const canvasLinkTargets = useCanvasLinkTargets();

  return useMutation({
    mutationFn: async ({
      quiz,
      moduleName,
    }: {
      quiz: LocalQuiz;
      moduleName: string;
    }) => {
      if (!canvasModules) {
        console.log("cannot add quiz until modules loaded");
        return;
      }
      const assignmentGroup = settings.assignmentGroups.find(
        (g) => g.name === quiz.localAssignmentGroupName
      );
      const canvasQuizId = await canvasQuizService.create(
        settings.canvasId,
        quiz,
        settings,
        assignmentGroup?.canvasId,
        canvasLinkTargets
      );

      const canvasModule = canvasModules.find((c) => c.name === moduleName);
      const moduleId = canvasModule
        ? canvasModule.id
        : await addModule.mutateAsync(moduleName);

      await canvasModuleService.createModuleItem(
        settings.canvasId,
        moduleId,
        quiz.name,
        "Quiz",
        canvasQuizId
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: canvasQuizKeys.quizzes(settings.canvasId),
      });
    },
  });
};

const submissionWarning = (count: number) =>
  `${count} student${count === 1 ? " has" : "s have"} already started this quiz in Canvas.

Updating replaces its questions. Students who already started keep the questions and answer key they got, and Canvas will not regrade them. If the point total changes, their scores are out of the new total.

Update anyway?`;

/**
 * Makes an existing Canvas quiz match the file, settings and questions,
 * showing each step in a toast. Asks first if students have already started.
 */
export const useUpdateQuizInCanvasMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const canvasLinkTargets = useCanvasLinkTargets();

  return useMutation({
    mutationFn: async ({
      quiz,
      canvasQuizId,
    }: {
      quiz: LocalQuiz;
      canvasQuizId: number;
    }) => {
      const submissions = await canvasQuizService.countSubmissions(
        settings.canvasId,
        canvasQuizId
      );
      if (submissions > 0 && !window.confirm(submissionWarning(submissions)))
        return;

      const progress = toast.loading("Updating quiz in Canvas");
      try {
        const assignmentGroup = settings.assignmentGroups.find(
          (g) => g.name === quiz.localAssignmentGroupName
        );
        const summary = await canvasQuizService.update(
          settings.canvasId,
          canvasQuizId,
          quiz,
          settings,
          {
            canvasAssignmentGroupId: assignmentGroup?.canvasId,
            canvasLinkTargets,
            onStep: (step) => toast.loading(`${step}…`, { id: progress }),
          }
        );
        toast.success(
          `Updated "${quiz.name}" in Canvas: settings, ${summary.questionsRemoved} questions removed, ${summary.questionsAdded} added${summary.republished ? ", and saved again for students" : " (quiz is unpublished)"}.`,
          { id: progress, duration: 8_000 }
        );
      } catch (error) {
        toast.dismiss(progress);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: canvasQuizKeys.quizzes(settings.canvasId),
      });
    },
    onError: (error) => {
      console.error("Failed to update quiz in Canvas:", error);
      showErrorToast(error.message);
    },
  });
};

export const useDeleteQuizFromCanvasMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (canvasQuizId: number) => {
      await canvasQuizService.delete(settings.canvasId, canvasQuizId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: canvasQuizKeys.quizzes(settings.canvasId),
      });
    },
  });
};
