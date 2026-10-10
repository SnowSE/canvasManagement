export interface CanvasQuizAnswer {
  id: number;
  text: string;
  html?: string;
  weight: number;
  comments?: string;
  // matching
  left?: string;
  right?: string;
  // fill in multiple blanks and multiple dropdowns
  blank_id?: string;
  // numerical
  numerical_answer_type?: string;
  exact?: number;
  margin?: number;
  start?: number;
  end?: number;
}
