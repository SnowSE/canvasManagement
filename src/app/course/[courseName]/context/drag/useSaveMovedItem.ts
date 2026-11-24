"use client";
import { useCallback } from "react";
import { ItemKind } from "@/features/local/course/courseItemTypes";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { useUpdateAssignmentMutation } from "@/features/local/assignments/assignmentHooks";
import { useUpdatePageMutation } from "@/features/local/pages/pageHooks";
import { useUpdateQuizMutation } from "@/features/local/quizzes/quizHooks";
import { useCourseContext } from "../courseContext";

/**
 * Saves a module's item as a drop left it: `item` (with the dates it has
 * now) in module `to`, having been in `from`. The one place that knows how
 * each type of item is saved; the drop handlers don't.
 */
export function useSaveMovedItem() {
  const { courseName } = useCourseContext();
  const updateAssignment = useUpdateAssignmentMutation();
  const updateQuiz = useUpdateQuizMutation();
  const updatePage = useUpdatePageMutation();

  return useCallback(
    (type: ItemKind, item: IModuleItem, from: string, to: string) => {
      const { name } = item;
      const place = { courseName, moduleName: to, previousModuleName: from };
      if (type === "assignment") updateAssignment.mutate({ ...place, assignment: item as LocalAssignment, assignmentName: name, previousAssignmentName: name });
      else if (type === "quiz") updateQuiz.mutate({ ...place, quiz: item as LocalQuiz, quizName: name, previousQuizName: name });
      else updatePage.mutate({ ...place, page: item as LocalCoursePage, pageName: name, previousPageName: name });
    },
    [courseName, updateAssignment, updatePage, updateQuiz],
  );
}
