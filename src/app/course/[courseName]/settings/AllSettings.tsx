"use client";

import AssignmentGroupManagement from "./AssignmentGroupManagement";
import { CanvasNavigationManagement } from "./canvasNavigation.tsx/CanvasNavigationManagement";
import DaysOfWeekSettings from "./DaysOfWeekSettings";
import DefaultDueTime from "./DefaultDueTime";
import DefaultFileUploadTypes from "./DefaultFileUploadTypes";
import Classroom50Settings from "./Classroom50Settings";
import HolidayConfig from "./HolidayConfig";
import SettingsHeader from "./SettingsHeader";
import StartAndEndDate from "./StartAndEndDate";
import SubmissionDefaults from "./SubmissionDefaults";
import StudentsSettings from "./StudentsSettings";
import GroupsSettings from "./GroupsSettings";

export default function AllSettings() {
  return (
    <>
      <SettingsHeader />
      <DaysOfWeekSettings />
      <StartAndEndDate />
      <Classroom50Settings />
      <SubmissionDefaults />
      <DefaultFileUploadTypes />
      <DefaultDueTime />
      <AssignmentGroupManagement />
      <StudentsSettings />
      <GroupsSettings />
      <HolidayConfig />
      <CanvasNavigationManagement />
      <div className="p-16"></div>
      <div className="p-16"></div>
      <div className="p-16"></div>
      <div className="p-16"></div>
      <div className="p-16"></div>
    </>
  );
}
