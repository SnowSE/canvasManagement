import { z } from "zod";
export enum AssignmentSubmissionType {
  ONLINE_TEXT_ENTRY = "online_text_entry",
  ONLINE_UPLOAD = "online_upload",
  ONLINE_QUIZ = "online_quiz",
  DISCUSSION_TOPIC = "discussion_topic",
  ONLINE_URL = "online_url",
  ON_PAPER = "on_paper",
  EXTERNAL_TOOL = "external_tool",
  NONE = "none",
  NOT_GRADED = "not_graded",
}
export const zodAssignmentSubmissionType = z.enum([
  AssignmentSubmissionType.ONLINE_TEXT_ENTRY,
  AssignmentSubmissionType.ONLINE_UPLOAD,
  AssignmentSubmissionType.ONLINE_QUIZ,
  AssignmentSubmissionType.DISCUSSION_TOPIC,
  AssignmentSubmissionType.ONLINE_URL,
  AssignmentSubmissionType.ON_PAPER,
  AssignmentSubmissionType.EXTERNAL_TOOL,
  AssignmentSubmissionType.NONE,
  AssignmentSubmissionType.NOT_GRADED,
]);

export const AssignmentSubmissionTypeList: AssignmentSubmissionType[] = [
  AssignmentSubmissionType.ONLINE_TEXT_ENTRY,
  AssignmentSubmissionType.ONLINE_UPLOAD,
  AssignmentSubmissionType.ONLINE_QUIZ,
  AssignmentSubmissionType.DISCUSSION_TOPIC,
  AssignmentSubmissionType.ONLINE_URL,
  AssignmentSubmissionType.ON_PAPER,
  AssignmentSubmissionType.EXTERNAL_TOOL,
  AssignmentSubmissionType.NONE,
  AssignmentSubmissionType.NOT_GRADED,
] as const;
