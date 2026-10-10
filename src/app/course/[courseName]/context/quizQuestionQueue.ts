import { getDateFromString } from "@/features/local/utils/timeUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which quizzes the calendar checks question by question, in the order to
 * fetch them: this week's (Sunday through Saturday) first, then the next three
 * weeks', each by due date. Quizzes outside those four weeks are not fetched,
 * so their calendar status covers settings and description only.
 */
export function quizzesToCheck(
  quizzes: { name: string; dueAt: string }[],
  today: Date,
): string[] {
  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const windowEnd = weekStart.getTime() + 28 * DAY_MS;

  return quizzes
    .map((quiz) => ({ name: quiz.name, due: getDateFromString(quiz.dueAt) }))
    .filter(
      (quiz): quiz is { name: string; due: Date } =>
        quiz.due !== undefined &&
        quiz.due.getTime() >= weekStart.getTime() &&
        quiz.due.getTime() < windowEnd,
    )
    .sort((a, b) => a.due.getTime() - b.due.getTime())
    .map((quiz) => quiz.name)
    .filter((name, i, names) => names.indexOf(name) === i);
}
