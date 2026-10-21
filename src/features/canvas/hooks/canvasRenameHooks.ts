"use client";
import { QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { showErrorToast } from "@/app/MyToaster";
import { CanvasAssignment } from "../models/assignments/canvasAssignment";
import { CanvasQuiz } from "../models/quizzes/canvasQuizModel";
import { CanvasPage } from "../models/pages/canvasPageModel";
import { canvasAssignmentService } from "../services/canvasAssignmentService";
import { canvasQuizService } from "../services/canvasQuizService";
import { canvasPageService } from "../services/canvasPageService";
import { canvasAssignmentKeys } from "./canvasAssignmentHooks";
import { canvasQuizKeys } from "./canvasQuizHooks";
import { canvasPageKeys } from "./canvasPageHooks";
import { canvasCourseModuleKeys } from "./canvasModuleHooks";

// A file finds its Canvas item by name, so renaming only the file would leave
// the Canvas item behind and the file looking like it was never added. These
// rename the file and then the Canvas item with it.

interface RenameVariables {
  oldName: string;
  newName: string;
  /** Renames the file; runs after the Canvas checks pass. */
  renameFile: () => Promise<unknown>;
}

const useRenameWithCanvas = <T>({
  noun,
  queryKey,
  getAll,
  nameOf,
  rename,
}: {
  noun: string;
  queryKey: (canvasCourseId: number) => QueryKey;
  getAll: (canvasCourseId: number) => Promise<T[]>;
  nameOf: (item: T) => string;
  rename: (canvasCourseId: number, item: T, newName: string) => Promise<void>;
}) => {
  const { data: settings } = useLocalCourseSettingsQuery();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ oldName, newName, renameFile }: RenameVariables) => {
      // fresh, so a rename made in Canvas since the last load is seen
      const items = await queryClient.fetchQuery({
        queryKey: queryKey(settings.canvasId),
        queryFn: () => getAll(settings.canvasId),
        staleTime: 0,
      });
      const inCanvas = items.find((i) => nameOf(i) === oldName);
      // With no Canvas item under the old name, a new name that matches one
      // links the file to it, so only a rename that would make two is refused.
      if (inCanvas && items.some((i) => nameOf(i) === newName))
        throw new Error(
          `Canvas already has a ${noun} named "${newName}". Rename or delete that one first.`,
        );

      await renameFile();
      if (!inCanvas) return;

      try {
        await rename(settings.canvasId, inCanvas, newName);
      } catch (error) {
        // the file is renamed, so this is reported rather than thrown
        const reason = error instanceof Error ? error.message : String(error);
        showErrorToast(
          `Renamed the file, but not the ${noun} in Canvas (${reason}). Rename "${oldName}" to "${newName}" in Canvas to keep them linked.`,
        );
      } finally {
        queryClient.invalidateQueries({ queryKey: queryKey(settings.canvasId) });
        queryClient.invalidateQueries({
          queryKey: canvasCourseModuleKeys.modules(settings.canvasId),
        });
      }
    },
  });
};

export const useRenameAssignmentMutation = () =>
  useRenameWithCanvas<CanvasAssignment>({
    noun: "assignment",
    queryKey: canvasAssignmentKeys.assignments,
    getAll: canvasAssignmentService.getAll,
    nameOf: (a) => a.name,
    rename: (courseId, a, name) => canvasAssignmentService.rename(courseId, a.id, name),
  });

export const useRenameQuizMutation = () =>
  useRenameWithCanvas<CanvasQuiz>({
    noun: "quiz",
    queryKey: canvasQuizKeys.quizzes,
    getAll: canvasQuizService.getAll,
    nameOf: (q) => q.title,
    rename: (courseId, q, title) => canvasQuizService.rename(courseId, q.id, title),
  });

export const useRenamePageMutation = () =>
  useRenameWithCanvas<CanvasPage>({
    noun: "page",
    queryKey: canvasPageKeys.pagesInCourse,
    getAll: canvasPageService.getAll,
    nameOf: (p) => p.title,
    rename: canvasPageService.rename,
  });
