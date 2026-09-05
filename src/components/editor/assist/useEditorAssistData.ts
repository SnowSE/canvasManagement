"use client";
import { useMemo } from "react";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import {
  useRosterGroupSetsQuery,
  useRosterStudentsQuery,
} from "@/features/canvas/roster/rosterHooks";
import {
  getDateFromString,
  getDateOnlyMarkdownString,
} from "@/features/local/utils/timeUtils";
import { EditorAssistData } from "./editorAssistData";

export function useEditorAssistData(): EditorAssistData {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: roster } = useRosterStudentsQuery();
  const { data: groupSets } = useRosterGroupSetsQuery();

  return useMemo(
    () => ({
      students:
        roster?.students.map((s) => ({
          id: s.id,
          sortableName: s.sortableName,
        })) ?? [],
      studentsLoaded: !!roster,
      groupSets:
        groupSets?.groupSets.map((g) => ({
          name: g.name,
          groupCount: g.groups.length,
          studentCount: g.groups.reduce((n, gr) => n + gr.members.length, 0),
        })) ?? [],
      groupSetsLoaded: !!groupSets,
      assignmentGroupNames: settings.assignmentGroups.map((g) => g.name),
      fileUploadTypes: settings.defaultFileUploadTypes,
      calendar: {
        daysOfWeek: settings.daysOfWeek,
        holidays: settings.holidays
          .flatMap((h) => h.days)
          .map((d) => getDateFromString(d))
          .filter((d): d is Date => !!d)
          .map(getDateOnlyMarkdownString),
        startDate: settings.startDate,
        endDate: settings.endDate,
        defaultDueTime: settings.defaultDueTime,
      },
    }),
    [settings, roster, groupSets]
  );
}
