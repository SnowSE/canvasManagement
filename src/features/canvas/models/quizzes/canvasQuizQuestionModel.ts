import { CanvasQuizAnswer } from "./canvasQuizAnswerModel";

export interface CanvasQuizQuestion {
  id: number;
  quiz_id: number;
  position?: number;
  question_name: string;
  question_type: string;
  question_text: string;
  points_possible?: number;
  correct_comments: string;
  incorrect_comments: string;
  neutral_comments: string;
  answers?: CanvasQuizAnswer[];
  /** Matching: the extra right-hand options, one per line. */
  matching_answer_incorrect_matches?: string | null;
}
