"use client";
import { canvasQuizService } from "@/features/canvas/services/canvasQuizService";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useCourseContext } from "../../../context/courseContext";
import { useMarkdownItemStatusOf } from "../../../calendar/day/useMarkdownItemStatus";
import { QuizIcon } from "../../../itemIcons";
import { type ItemKindDef, unpublishedOnly } from "../../../itemKind";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { useQuizzesQueries, useUpdateQuizMutation } from "@/features/local/quizzes/quizHooks";
import {
  useAddQuizToCanvasMutation,
  useCanvasQuizzesQuery,
  useRefreshCanvasQuiz,
  useDeleteQuizFromCanvasMutation,
  useUpdateQuizInCanvasMutation,
} from "@/features/canvas/hooks/canvasQuizHooks";

/** What a quiz is and does, for the pages that show any item (see itemKinds). */
export const quizKind: ItemKindDef = {
  Icon: QuizIcon,
  markdown: "Quiz",
  useModuleItems: (moduleName) => useQuizzesQueries(moduleName).data,
  useStatusOf: () => useMarkdownItemStatusOf("quiz"),
  useSendToCanvas() {
    const { data: inCanvas } = useCanvasQuizzesQuery();
    const add = useAddQuizToCanvasMutation();
    const update = useUpdateQuizInCanvasMutation();
    return ({ item, moduleName }) => {
      const quiz = item as LocalQuiz;
      const there = inCanvas?.find((q) => q.title === item.name);
      return there ? update.mutateAsync({ quiz, canvasQuizId: there.id, moduleName }) : add.mutateAsync({ quiz, moduleName });
    };
  },
  usePublish() {
    const { data: settings } = useLocalCourseSettingsQuery();
    return (id) => canvasQuizService.publish(settings.canvasId, id);
  },
  useRefresh: useRefreshCanvasQuiz,
  useRemoveUnpublished() {
    const { data: inCanvas } = useCanvasQuizzesQuery();
    const remove = useDeleteQuizFromCanvasMutation();
    return ({ item }) => remove.mutateAsync(unpublishedOnly(inCanvas?.find((q) => q.title === item.name), item.name).id);
  },
  useSaveMoved() {
    const { courseName } = useCourseContext();
    const update = useUpdateQuizMutation();
    return (item, from, to) => update.mutate({ courseName, moduleName: to, previousModuleName: from, quiz: item as LocalQuiz, quizName: item.name, previousQuizName: item.name });
  },
};
