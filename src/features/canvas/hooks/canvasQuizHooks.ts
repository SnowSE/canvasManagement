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
import { useCommitAfterPublish } from "@/features/local/git/gitHooks";
import {
  quizMarkdownParts,
  usePrepareImagesForCanvas,
} from "./usePrepareImagesForCanvas";
import toast from "react-hot-toast";
import { showActionNeededToast, showErrorToast } from "@/app/MyToaster";
import { baseCanvasUrl } from "../services/canvasServiceUtils";

export const canvasQuizKeys = {
  quizzes: (canvasCourseId: number) =>
    ["canvas", canvasCourseId, "quizzes"] as const,
  // under quizzes, so anything that refreshes the quizzes refreshes these too
  questions: (canvasCourseId: number, canvasQuizId: number) =>
    ["canvas", canvasCourseId, "quizzes", canvasQuizId, "questions"] as const,
};

export const useCanvasQuizzesQuery = () => {
  const { data: settings } = useLocalCourseSettingsQuery();

  return useQuery({
    queryKey: canvasQuizKeys.quizzes(settings.canvasId),
    queryFn: async () => canvasQuizService.getAll(settings.canvasId),
  });
};

/** A quiz's questions as Canvas has them, in quiz order. */
export const useCanvasQuizQuestionsQuery = (canvasQuizId: number | undefined) => {
  const { data: settings } = useLocalCourseSettingsQuery();

  return useQuery({
    queryKey: canvasQuizKeys.questions(settings.canvasId, canvasQuizId ?? 0),
    queryFn: async () =>
      canvasQuizService.getQuizQuestions(settings.canvasId, canvasQuizId!),
    enabled: canvasQuizId !== undefined,
  });
};

export const useAddQuizToCanvasMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const { data: canvasModules } = useCanvasModulesQuery();
  const addModule = useAddCanvasModuleMutation();
  const canvasLinkTargets = useCanvasLinkTargets();
  const prepareImages = usePrepareImagesForCanvas();

  const commitAfterPublish = useCommitAfterPublish();

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
      const publishSettings = await prepareImages(quizMarkdownParts(quiz));
      const canvasQuizId = await canvasQuizService.create(
        settings.canvasId,
        quiz,
        publishSettings,
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
    onSuccess: (_data, variables) => {
      commitAfterPublish(`quiz "${variables.quiz.name}"`);
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
 * showing each step in a toast. Asks first if students have already started,
 * and ends by saying if Canvas still needs "Save it now" (see
 * canvasQuizService.update for why the app can't do that itself).
 */
export const useUpdateQuizInCanvasMutation = () => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();
  const canvasLinkTargets = useCanvasLinkTargets();
  const prepareImages = usePrepareImagesForCanvas();

  const commitAfterPublish = useCommitAfterPublish();

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
        return false;

      const progress = toast.loading("Updating quiz in Canvas");
      try {
        const assignmentGroup = settings.assignmentGroups.find(
          (g) => g.name === quiz.localAssignmentGroupName
        );
        const publishSettings = await prepareImages(quizMarkdownParts(quiz));
        const summary = await canvasQuizService.update(
          settings.canvasId,
          canvasQuizId,
          quiz,
          publishSettings,
          {
            canvasAssignmentGroupId: assignmentGroup?.canvasId,
            canvasLinkTargets,
            onStep: (step) => toast.loading(`${step}…`, { id: progress }),
          }
        );
        const updated = `Updated "${quiz.name}" in Canvas: settings, ${summary.questionsRemoved} questions removed, ${summary.questionsAdded} added.`;
        if (summary.needsSaveInCanvas) {
          toast.dismiss(progress);
          showActionNeededToast(
            `${updated} Students still get the old questions until you click "Save it now" on the quiz page.`,
            `${baseCanvasUrl}/courses/${settings.canvasId}/quizzes/${canvasQuizId}`,
            "Open the quiz in Canvas",
          );
        } else {
          toast.success(`${updated} Students will get them when you publish.`, {
            id: progress,
            duration: 8_000,
          });
        }
      } catch (error) {
        toast.dismiss(progress);
        throw error;
      }
      return true;
    },
    onSuccess: (updated, variables) => {
      // false: cancelled at the "students already started" question
      if (updated) commitAfterPublish(`quiz "${variables.quiz.name}"`);
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
