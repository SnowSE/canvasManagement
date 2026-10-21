// New Quizzes (the quiz LTI) has its own API beside /api/v1. Its quiz id is
// the id of the Canvas assignment that holds it. Only what import reads is
// typed; an item's interaction and scoring data differ by question type.

export interface CanvasNewQuiz {
  id: string;
  title: string;
  instructions?: string | null;
  points_possible?: number;
  due_at?: string | null;
  lock_at?: string | null;
  unlock_at?: string | null;
  published?: boolean;
  quiz_settings?: {
    shuffle_answers?: boolean;
    shuffle_questions?: boolean;
    one_at_a_time_type?: string; // "none" | "question"
    has_time_limit?: boolean;
    session_time_limit_in_seconds?: number;
    require_student_access_code?: boolean;
    student_access_code?: string | null;
    multiple_attempts?: {
      multiple_attempts_enabled?: boolean;
      attempt_limit?: boolean;
      max_attempts?: number | null;
    };
    result_view_settings?: {
      result_view_restricted?: boolean;
      display_item_correct_answer?: boolean;
    };
  };
}

export interface CanvasNewQuizItem {
  id: string;
  position: number;
  points_possible?: number;
  /** "Item" is a question; "Stimulus" a passage; "BankEntry" / "Bank" pull from an item bank. */
  entry_type: string;
  entry?: {
    title?: string | null;
    item_body?: string;
    body?: string;
    interaction_type_slug?: string;
    interaction_data?: Record<string, unknown>;
    scoring_data?: { value?: unknown; [key: string]: unknown };
    feedback?: { neutral?: string; correct?: string; incorrect?: string };
  };
}
