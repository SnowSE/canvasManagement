"use client";
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { checkedQuizzes, useCheckAllRequests } from "@/features/canvas/hooks/checkedQuizzes";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { CanvasQuizQuestion } from "@/features/canvas/models/quizzes/canvasQuizQuestionModel";
import {
  canvasQuizKeys,
  useCanvasQuizzesQuery,
} from "@/features/canvas/hooks/canvasQuizHooks";
import { canvasQuizService } from "@/features/canvas/services/canvasQuizService";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useCalendarItemsContext } from "./calendarItemsContext";
import { quizzesToCheck } from "./quizQuestionQueue";

// Canvas throttles by request cost, so the calendar asks for one quiz's
// questions at a time with a pause between, and backs off when refused.
const PAUSE_MS = 2000;
const BACKOFF_MS = 30000;
// questions fetched within this long are reused instead of asked for again
const FRESH_MS = 10 * 60 * 1000;

/** Canvas questions by quiz name, for the quizzes the queue has reached. */
const CalendarQuizQuestionsContext = createContext<
  Record<string, CanvasQuizQuestion[] | undefined>
>({});

export function useCalendarQuizQuestions() {
  return useContext(CalendarQuizQuestionsContext);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches the questions of the quizzes worth checking (see quizzesToCheck: those edited this session, the next four weeks', and after Reload Canvas Data every one) in
 * the background, one at a time, so the calendar can flag a quiz whose
 * questions differ from Canvas. Shares its cache with the editor and the
 * compare page.
 */
export default function CalendarQuizQuestionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasQuizzes } = useCanvasQuizzesQuery();
  const calendarItems = useCalendarItemsContext();
  const queryClient = useQueryClient();

  const quizzes = useMemo(
    () => Object.values(calendarItems).flatMap((modules) => Object.values(modules).flatMap((m) => m.quizzes)),
    [calendarItems],
  );
  // the quizzes whose questions changed in their files this session, by the app or anything else: their status may have changed
  const seen = useRef(new Map<string, string>());
  const [edited, setEdited] = useState<string[]>([]);
  useEffect(() => {
    const changed = quizzes.filter((q) => {
      const now = JSON.stringify(q.questions);
      const before = seen.current.get(q.name);
      seen.current.set(q.name, now);
      return before !== undefined && before !== now;
    });
    if (changed.length) setEdited((e) => [...changed.map((q) => q.name), ...e.filter((n) => !changed.some((q) => q.name === n))]);
  }, [quizzes]);
  const checkAll = useCheckAllRequests() > 0;

  const queue = useMemo(() => {
    // a quiz in Canvas with no matching last check is checked once; after that its last check stands until its file changes
    const unmatched = quizzes.filter((q) => canvasQuizzes?.some((c) => c.title === q.name) && !checkedQuizzes.stillMatches(settings.canvasId, q.name, q.questions)).map((q) => q.name);
    return quizzesToCheck(quizzes, new Date(), edited, checkAll, unmatched).flatMap((name) => {
      const canvasQuiz = canvasQuizzes?.find((q) => q.title === name);
      return canvasQuiz ? [{ name, canvasQuizId: canvasQuiz.id }] : [];
    });
  }, [quizzes, edited, checkAll, canvasQuizzes, settings.canvasId]);

  const queryFor = (canvasQuizId: number) => ({
    queryKey: canvasQuizKeys.questions(settings.canvasId, canvasQuizId),
    queryFn: () =>
      canvasQuizService.getQuizQuestions(settings.canvasId, canvasQuizId),
  });

  // subscribe without fetching: the loop below does the fetching
  const questions = useQueries({
    queries: queue.map(({ canvasQuizId }) => ({
      ...queryFor(canvasQuizId),
      enabled: false,
    })),
    combine: (results) => results.map((r) => r.data),
  });

  // queue changes whenever the Canvas quiz list refetches, which is also
  // when an update invalidates the questions, so this re-walks the queue
  const queueKey = queue.map((q) => q.canvasQuizId).join(",");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const { canvasQuizId } of queue) {
        if (cancelled) return;
        const query = queryFor(canvasQuizId);
        const state = queryClient.getQueryState(query.queryKey);
        const fresh =
          state?.data !== undefined &&
          !state.isInvalidated &&
          Date.now() - state.dataUpdatedAt < FRESH_MS;
        if (fresh) continue;
        try {
          await queryClient.fetchQuery(query);
        } catch {
          // most likely throttled: wait it out, try once more, then move on
          await sleep(BACKOFF_MS);
          if (cancelled) return;
          await queryClient.fetchQuery(query).catch(() => undefined);
        }
        await sleep(PAUSE_MS);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey, settings.canvasId, queryClient]);

  const questionsByName = useMemo(
    () => Object.fromEntries(queue.map((q, i) => [q.name, questions[i]])),
    [queue, questions],
  );

  return (
    <CalendarQuizQuestionsContext.Provider value={questionsByName}>
      {children}
    </CalendarQuizQuestionsContext.Provider>
  );
}
