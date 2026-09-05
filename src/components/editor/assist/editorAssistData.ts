import { DayOfWeek, SimpleTimeOnly } from "@/features/local/course/localCourseSettings";
import { StudentRef } from "@/features/local/assignments/models/utils/scheduleUtils";

/** Everything the editor popups need, gathered from settings and the server's Canvas cache. */
export interface EditorAssistData {
  students: StudentRef[];
  studentsLoaded: boolean;
  groupSets: { name: string; groupCount: number; studentCount: number }[];
  groupSetsLoaded: boolean;
  assignmentGroupNames: string[];
  fileUploadTypes: string[];
  calendar: {
    daysOfWeek: DayOfWeek[];
    holidays: string[]; // MM/DD/YYYY
    startDate: string;
    endDate: string;
    defaultDueTime: SimpleTimeOnly;
  };
}

export const emptyAssistData: EditorAssistData = {
  students: [],
  studentsLoaded: false,
  groupSets: [],
  groupSetsLoaded: false,
  assignmentGroupNames: [],
  fileUploadTypes: [],
  calendar: {
    daysOfWeek: [],
    holidays: [],
    startDate: "",
    endDate: "",
    defaultDueTime: { hour: 23, minute: 59 },
  },
};

// Monaco completion providers are registered once per language, not per
// editor, so the provider reads the latest data through this shared ref.
export const assistDataRef: { current: EditorAssistData } = {
  current: emptyAssistData,
};
