import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAddCanvasModuleMutation,
  useCanvasModulesQuery,
  usePlaceInCanvasModule,
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
import {
  checkQuizQuestions,
  pointTotalChangeError,
} from "@/app/course/[courseName]/calendar/day/quizQuestionSync";

export const canvasQuizKeys = {
  quizzes: (canvasCourseId: number) =>
    ["canvas", canvasCourseId, "quizzes"] as const,
  // under quizzes, so anything that refreshes the quizzes refreshes these too
  questions: (canvasCourseId: number, canvasQuizId: number) =>
    ["canvas", canvasCourseId, "quizzes", canvasQuizId, "questions"] as const,
  versionsTaken: (canvasCourseId: number, canvasQuizId: number) =>
    ["canvas", canvasCourseId, "quizzes", canvasQuizId, "versionsTaken"] as const,
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

/** Each quiz version students took, newest first; empty if nobody started. */
export const useCanvasQuizVersionsTakenQuery = (
  canvasQuizId: number | undefined,
) => {
  const { data: settings } = useLocalCourseSettingsQuery();

  return useQuery({
    queryKey: canvasQuizKeys.versionsTaken(settings.canvasId, canvasQuizId ?? 0),
    queryFn: () =>
      canvasQuizService.getVersionsTaken(settings.canvasId, canvasQuizId!),
    enabled: canvasQuizId !== undefined,
  });
};

/** The questions one attempt got; an attempt never changes, so it is never refetched. */
export const useCanvasAttemptQuestionsQuery = (attemptId: number | undefined) =>
  useQuery({
    queryKey: ["canvas", "quizAttemptQuestions", attemptId],
    queryFn: () => canvasQuizService.getAttemptQuestions(attemptId!),
    enabled: attemptId !== undefined,
    staleTime: Infinity,
  });

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

Updating replaces its questions. Students who already started keep the questions and answer key they got, and Canvas will not regrade them.

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
  const placeInModule = usePlaceInCanvasModule();

  const commitAfterPublish = useCommitAfterPublish();

  return useMutation({
    mutationFn: async ({
      quiz,
      canvasQuizId,
      moduleName,
    }: {
      quiz: LocalQuiz;
      canvasQuizId: number;
      moduleName: string;
    }) => {
      const versions = await canvasQuizService.getVersionsTaken(
        settings.canvasId,
        canvasQuizId
      );
      if (versions.length > 0) {
        const studentsGot = await canvasQuizService.getAttemptQuestions(
          versions[0].attemptId
        );
        const pointsError = pointTotalChangeError(quiz.questions, studentsGot);
        if (pointsError) throw new Error(pointsError);
        const submissions = versions.reduce((sum, v) => sum + v.attempts, 0);
        if (!window.confirm(submissionWarning(submissions))) return false;
      }

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
            questionsMatch: (canvasQuestions) =>
              checkQuizQuestions(
                quiz.questions,
                canvasQuestions,
                publishSettings,
              ).every((q) => q.same),
          }
        );
        await placeInModule(moduleName, {
          type: "Quiz",
          id: canvasQuizId,
          title: quiz.name,
        });
        const updated = summary.questionsReplaced
          ? `Updated "${quiz.name}" in Canvas: settings, ${summary.questionsRemoved} questions removed, ${summary.questionsAdded} added.`
          : `Updated "${quiz.name}" in Canvas: settings. Its questions already matched the file, so they were left alone.`;
        if (summary.needsSaveInCanvas) {
          toast.dismiss(progress);
          showActionNeededToast(
            `${updated} Students still get the old questions until you click "Save it now" on the quiz page.`,
            `${baseCanvasUrl}/courses/${settings.canvasId}/quizzes/${canvasQuizId}`,
            "Open the quiz in Canvas",
          );
        } else {
          toast.success(
            summary.questionsReplaced
              ? `${updated} Students will get them when you publish.`
              : updated,
            { id: progress, duration: 8_000 },
          );
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
