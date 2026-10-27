import { LocalQuizQuestion } from "./localQuizQuestion";

/**
 * What the quiz is out of: each question's points, except that a question
 * group counts its points once for each question a student gets from it.
 */
export function quizPointTotal(questions: LocalQuizQuestion[]) {
  const groupsCounted = new Set<string>();
  return questions.reduce((sum, question) => {
    if (!question.group) return sum + question.points;
    if (groupsCounted.has(question.group.name)) return sum;
    groupsCounted.add(question.group.name);
    return sum + question.group.pickCount * question.points;
  }, 0);
}
