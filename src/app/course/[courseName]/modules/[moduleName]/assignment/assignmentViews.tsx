"use client";
import MarkdownDisplay from "@/components/MarkdownDisplay";
import { AssignmentDayItemContextMenu } from "../../../calendar/day/itemInDay/AssignmentDayItemContextMenu";
import { CompareAssignmentWithCanvas } from "../compare/CompareWithCanvas";
import EditAssignment from "./[assignmentName]/EditAssignment";
import { getClassroomReplaceText } from "@/features/local/classroom50/classroom50UrlUtils";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import type { ItemKindViews } from "../../../itemKind";

/** How an assignment is shown (see itemKindViews). */
export const assignmentViews: ItemKindViews = {
  Editor: ({ moduleName, name }) => <EditAssignment moduleName={moduleName} assignmentName={name} />,
  Menu: AssignmentDayItemContextMenu,
  Preview: function AssignmentPreview({ item }) {
    const { data: settings } = useLocalCourseSettingsQuery();
    const assignment = item as LocalAssignment;
    return <MarkdownDisplay markdown={assignment.description} replaceText={getClassroomReplaceText({ assignment, settings })} />;
  },
  Compare: ({ moduleName, name }) => <CompareAssignmentWithCanvas moduleName={moduleName} assignmentName={name} />,
};
