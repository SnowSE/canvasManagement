import { CanvasLinkTargets } from "@/services/urlUtils";
import { useCanvasAssignmentsQuery } from "./canvasAssignmentHooks";
import { useCanvasQuizzesQuery } from "./canvasQuizHooks";

// The course's canvas assignments/quizzes, used to resolve relative .md links
// between items when publishing markdown to canvas.
export const useCanvasLinkTargets = (): CanvasLinkTargets => {
  const { data: assignments } = useCanvasAssignmentsQuery();
  const { data: quizzes } = useCanvasQuizzesQuery();
  return { assignments, quizzes };
};
