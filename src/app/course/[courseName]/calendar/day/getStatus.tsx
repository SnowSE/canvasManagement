"use client";
import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import { CanvasPage } from "@/features/canvas/models/pages/canvasPageModel";
import { CanvasQuiz } from "@/features/canvas/models/quizzes/canvasQuizModel";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import {
  getSyncStatus,
  ItemSyncStatus,
  RosterForStatus,
} from "./getAssignmentSyncStatus";
import { CanvasLinkTargets } from "@/services/urlUtils";
import { CanvasQuizQuestion } from "@/features/canvas/models/quizzes/canvasQuizQuestionModel";

export const getStatus = ({
  item,
  canvasItem,
  type,
  settings,
  canvasLinkTargets,
  roster,
  canvasQuestions,
}: {
  item: LocalQuiz | LocalAssignment | LocalCoursePage;
  canvasItem?: CanvasQuiz | CanvasAssignment | CanvasPage;
  type: "assignment" | "page" | "quiz";
  settings: LocalCourseSettings;
  canvasLinkTargets?: CanvasLinkTargets;
  roster?: RosterForStatus;
  canvasQuestions?: CanvasQuizQuestion[];
}): ItemSyncStatus => {
  return getSyncStatus({
    item,
    canvasItem,
    type,
    settings,
    canvasLinkTargets,
    roster,
    canvasQuestions,
  });
};
