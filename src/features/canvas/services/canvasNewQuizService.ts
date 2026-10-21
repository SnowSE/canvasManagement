import {
  CanvasNewQuiz,
  CanvasNewQuizItem,
} from "@/features/canvas/models/quizzes/canvasNewQuizModel";
import { axiosClient } from "@/services/axiosUtils";
import { baseCanvasUrl } from "./canvasServiceUtils";

const newQuizApi = baseCanvasUrl + "/api/quiz/v1";

export const canvasNewQuizService = {
  /** `assignmentId` is the Canvas assignment holding the quiz. */
  async get(courseId: number, assignmentId: number): Promise<CanvasNewQuiz> {
    const url = `${newQuizApi}/courses/${courseId}/quizzes/${assignmentId}`;
    const { data } = await axiosClient.get<CanvasNewQuiz>(url);
    return data;
  },

  async getItems(courseId: number, assignmentId: number): Promise<CanvasNewQuizItem[]> {
    const url = `${newQuizApi}/courses/${courseId}/quizzes/${assignmentId}/items`;
    const { data } = await axiosClient.get<CanvasNewQuizItem[]>(url);
    return [...data].sort((a, b) => a.position - b.position);
  },
};
