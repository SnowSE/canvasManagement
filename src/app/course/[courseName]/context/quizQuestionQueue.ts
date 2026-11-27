import { getDateFromString } from "@/features/local/utils/timeUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which quizzes the calendar checks question by question, in the order to
 * fetch them: those edited this session first (`edited`: their status may
 * have changed, whenever they are due), then this week's (Sunday through
 * Saturday) and the next three weeks', each by due date. Any other quiz is
 * fetched when it has no matching last check (`unmatched`: never checked in
 * this browser, or its file changed since), once, and after the user reloads
 * Canvas's data (`everything`); otherwise its last check stands.
 */
export function quizzesToCheck(
  quizzes: { name: string; dueAt: string }[],
  today: Date,
  edited: string[] = [],
  /** After the user reloads Canvas's data: every quiz, the four weeks first, then the rest nearest to today. */
  everything = false,
  /** Quizzes with no matching last check (see checkedQuizzes): checked once, after the four weeks. */
  unmatched: string[] = [],
): string[] {
  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const windowEnd = weekStart.getTime() + 28 * DAY_MS;

  const inWindow = (due: number) => due >= weekStart.getTime() && due < windowEnd;
  const order = (a: number, b: number) =>
    inWindow(a) !== inWindow(b) ? (inWindow(a) ? -1 : 1) : inWindow(a) ? a - b : Math.abs(a - today.getTime()) - Math.abs(b - today.getTime());
  const coming = quizzes
    .map((quiz) => ({ name: quiz.name, due: getDateFromString(quiz.dueAt)?.getTime() }))
    .filter((quiz): quiz is { name: string; due: number } => quiz.due !== undefined && (everything || inWindow(quiz.due) || unmatched.includes(quiz.name)))
    .sort((a, b) => order(a.due, b.due))
    .map((quiz) => quiz.name);
  return [...edited.filter((name) => quizzes.some((q) => q.name === name)), ...coming].filter((name, i, names) => names.indexOf(name) === i);
}
