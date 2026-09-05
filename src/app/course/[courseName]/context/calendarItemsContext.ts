import {
  AssignmentScheduleEntry,
  LocalAssignment,
} from "@/features/local/assignments/models/localAssignment";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import { LocalQuiz } from "@/features/local/quizzes/models/localQuiz";
import { createContext, useContext } from "react";

export interface CalendarItemsInterface {
  [
    key: string // representing a date
  ]: {
    [moduleName: string]: {
      assignments: LocalAssignment[];
      quizzes: LocalQuiz[];
      pages: LocalCoursePage[];
      // an assignment's Schedule puts it on extra days, one entry per batch
      scheduledAssignments?: ScheduledAssignmentOccurrence[];
    };
  };
}

export interface ScheduledAssignmentOccurrence {
  assignment: LocalAssignment;
  entry: AssignmentScheduleEntry;
}

export const CalendarItemsContext = createContext<CalendarItemsInterface>({});

export function useCalendarItemsContext() {
  return useContext(CalendarItemsContext);
}
