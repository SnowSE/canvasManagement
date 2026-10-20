import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import {
  useAddAssignmentToCanvasMutation,
  useCanvasAssignmentsQuery,
  useDeleteAssignmentFromCanvasMutation,
  useUpdateAssignmentInCanvasMutation,
} from "@/features/canvas/hooks/canvasAssignmentHooks";
import {
  useAddQuizToCanvasMutation,
  useCanvasQuizzesQuery,
  useDeleteQuizFromCanvasMutation,
  useUpdateQuizInCanvasMutation,
} from "@/features/canvas/hooks/canvasQuizHooks";
import {
  useCanvasPagesQuery,
  useCreateCanvasPageMutation,
  useDeleteCanvasPageMutation,
  useUpdateCanvasPageMutation,
} from "@/features/canvas/hooks/canvasPageHooks";
import { ModuleItemRef } from "./moduleSelection";

// The module list's bulk actions: each item's own right-click actions, one
// type at a time (Canvas's assignment, quiz and page APIs differ).

/** Add to or update in Canvas, as in an item's right-click menu. */
export function useAddOrUpdateInCanvas() {
  const { data: canvasAssignments } = useCanvasAssignmentsQuery();
  const { data: canvasQuizzes } = useCanvasQuizzesQuery();
  const { data: canvasPages } = useCanvasPagesQuery();
  const addAssignment = useAddAssignmentToCanvasMutation();
  const addQuiz = useAddQuizToCanvasMutation();
  const addPage = useCreateCanvasPageMutation();
  const updateAssignment = useUpdateAssignmentInCanvasMutation();
  const updateQuiz = useUpdateQuizInCanvasMutation();
  const updatePage = useUpdateCanvasPageMutation();

  return async ({ type, item, moduleName }: ModuleItemRef) => {
    if (type === "assignment") {
      const assignment = item as LocalAssignment;
      const inCanvas = canvasAssignments?.find((a) => a.name === item.name);
      return inCanvas
        ? updateAssignment.mutateAsync({ assignment, canvasAssignmentId: inCanvas.id, moduleName })
        : addAssignment.mutateAsync({ assignment, moduleName });
    }
    if (type === "quiz") {
      const quiz = item as LocalQuiz;
      const inCanvas = canvasQuizzes?.find((q) => q.title === item.name);
      return inCanvas
        ? updateQuiz.mutateAsync({ quiz, canvasQuizId: inCanvas.id, moduleName })
        : addQuiz.mutateAsync({ quiz, moduleName });
    }
    const page = item as LocalCoursePage;
    const inCanvas = canvasPages?.find((p) => p.title === item.name);
    return inCanvas
      ? updatePage.mutateAsync({ page, canvasPage: inCanvas, moduleName })
      : addPage.mutateAsync({ page, moduleName });
  };
}

/**
 * Delete from Canvas, as in an item's right-click menu, but only an item
 * that's in Canvas unpublished: students can't see it, and its file stays.
 * Anything published is refused, checked again right before deleting.
 */
export function useRemoveUnpublishedFromCanvas() {
  const { data: canvasAssignments } = useCanvasAssignmentsQuery();
  const { data: canvasQuizzes } = useCanvasQuizzesQuery();
  const { data: canvasPages } = useCanvasPagesQuery();
  const removeAssignment = useDeleteAssignmentFromCanvasMutation();
  const removeQuiz = useDeleteQuizFromCanvasMutation();
  const removePage = useDeleteCanvasPageMutation();

  const unpublishedOnly = <T extends { published?: boolean }>(inCanvas: T | undefined, name: string) => {
    if (!inCanvas || inCanvas.published)
      throw new Error(`${name} isn't unpublished in Canvas, so it stays`);
    return inCanvas;
  };

  return async ({ type, item }: ModuleItemRef) => {
    if (type === "assignment") {
      const inCanvas = unpublishedOnly(canvasAssignments?.find((a) => a.name === item.name), item.name);
      return removeAssignment.mutateAsync({ canvasAssignmentId: inCanvas.id, assignmentName: item.name });
    }
    if (type === "quiz")
      return removeQuiz.mutateAsync(unpublishedOnly(canvasQuizzes?.find((q) => q.title === item.name), item.name).id);
    return removePage.mutateAsync(unpublishedOnly(canvasPages?.find((p) => p.title === item.name), item.name).page_id);
  };
}
