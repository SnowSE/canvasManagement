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
  /** Set when the question is in a question group. */
  quiz_group_id?: number | null;
  /** The question's group, which getQuizQuestions looks up from quiz_group_id. */
  quiz_group?: CanvasQuizGroup;
}

export interface CanvasQuizGroup {
  id: number;
  name: string;
  pick_count: number;
  question_points: number;
  position?: number;
  /** Set when the group draws from a question bank instead of its own questions. */
  assessment_question_bank_id?: number | null;
}
