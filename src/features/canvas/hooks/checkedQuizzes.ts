import { useSyncExternalStore } from "react";
import type { LocalQuizQuestion } from "@/features/local/quizzes/models/localQuizQuestion";

/**
 * What this browser remembers of quizzes whose questions matched Canvas's
 * when last checked, so a quiz outside the calendar's four weeks isn't
 * fetched just to be called in sync. Canvas is taken as unchanged unless the
 * user says otherwise (Reload Canvas Data forgets the course and checks every
 * quiz), so only the file's side is kept: the quiz still matches while its
 * file's questions are as they were, whoever edited the file.
 */
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
const prefix = (canvasCourseId: number) => `checkedQuiz/${canvasCourseId}/`;

export const checkedQuizzesIn = (store: () => Store) => ({
  remember(canvasCourseId: number, quizName: string, questions: LocalQuizQuestion[]) {
    try {
      store().setItem(prefix(canvasCourseId) + quizName, JSON.stringify(questions));
    } catch {
      // storage full or blocked: the quiz is checked again next time
    }
  },
  stillMatches(canvasCourseId: number, quizName: string, questions: LocalQuizQuestion[]) {
    try {
      return store().getItem(prefix(canvasCourseId) + quizName) === JSON.stringify(questions);
    } catch {
      return false;
    }
  },
  forgetCourse(canvasCourseId: number) {
    try {
      const s = store();
      const keys = Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => !!k?.startsWith(prefix(canvasCourseId)));
      keys.forEach((k) => s.removeItem(k));
    } catch {
      // nothing remembered can be read either
    }
  },
});

export const checkedQuizzes = checkedQuizzesIn(() => localStorage);

// Reload Canvas Data asks for every quiz to be checked, the calendar's background queue hears it
let checkAllRequests = 0;
const listeners = new Set<() => void>();
/** The user reloaded Canvas's data: what was remembered of the course goes, and every quiz is checked. */
export const requestCheckAll = (canvasCourseId: number) => {
  checkedQuizzes.forgetCourse(canvasCourseId);
  checkAllRequests++;
  listeners.forEach((l) => l());
};
/** How many times every quiz has been asked to be checked: more than none means everything. */
export const useCheckAllRequests = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => checkAllRequests,
    () => 0,
  );
