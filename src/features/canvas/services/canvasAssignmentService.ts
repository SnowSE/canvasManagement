import { CanvasAssignment } from "@/features/canvas/models/assignments/canvasAssignment";
import { canvasApi, paginatedRequest } from "./canvasServiceUtils";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { CanvasRubricCreationResponse } from "@/features/canvas/models/assignments/canvasRubricCreationResponse";
import { assignmentPoints } from "@/features/local/assignments/models/utils/assignmentPointsUtils";
import { getDateFromString } from "@/features/local/utils/timeUtils";
import { getRubricCriterion } from "./canvasRubricUtils";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { axiosClient } from "@/services/axiosUtils";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { CanvasLinkTargets } from "@/services/urlUtils";
import { getClassroomReplaceText } from "@/features/local/classroom50/classroom50UrlUtils";
import { rateLimitAwareDelete, rateLimitAwarePost } from "./canvasWebRequestUtils";
import { CanvasAssignmentOverride } from "@/features/canvas/models/assignments/canvasAssignmentOverride";
import { OverrideSpec } from "@/features/local/assignments/models/utils/scheduleUtils";

/** Group-set and per-student-date settings resolved against Canvas ids before publishing. */
export interface CanvasAssignmentPublishOptions {
  groupCategoryId?: number;
  gradeIndividually?: boolean;
  overrides?: OverrideSpec[];
}

export const canvasAssignmentService = {
  async getAll(courseId: number): Promise<CanvasAssignment[]> {
    // overrides ride along so the calendar can check scheduled students
    const url = `${canvasApi}/courses/${courseId}/assignments?include[]=overrides`;
    const assignments = await paginatedRequest<CanvasAssignment[]>({ url });
    return assignments.map((a) => ({
      ...a,
      due_at: a.due_at ? new Date(a.due_at).toLocaleString() : undefined, // timezones?
      lock_at: a.lock_at ? new Date(a.lock_at).toLocaleString() : undefined, // timezones?
      unlock_at: a.unlock_at
        ? new Date(a.unlock_at).toLocaleString()
        : undefined, // timezones?
    }));
  },

  async create(
    canvasCourseId: number,
    localAssignment: LocalAssignment,
    settings: LocalCourseSettings,
    canvasAssignmentGroupId?: number,
    canvasLinkTargets?: CanvasLinkTargets,
    publishOptions?: CanvasAssignmentPublishOptions
  ) {
    console.log(`Creating assignment: ${localAssignment.name}`);
    const url = `${canvasApi}/courses/${canvasCourseId}/assignments`;
    const content = markdownToHTMLSafe({
      markdownString: localAssignment.description,
      settings,
      replaceText: getClassroomReplaceText({
        assignment: localAssignment,
        settings,
        strict: true,
      }),
      canvasLinkTargets,
    });

    const body = {
      assignment: {
        name: localAssignment.name,
        submission_types: localAssignment.submissionTypes.map((t) =>
          t.toString()
        ),
        allowed_extensions: localAssignment.allowedFileUploadExtensions.map(
          (e) => e.toString()
        ),
        description: content,
        due_at: getDateFromString(localAssignment.dueAt)?.toISOString(),
        lock_at:
          localAssignment.lockAt &&
          getDateFromString(localAssignment.lockAt)?.toISOString(),
        unlock_at:
          localAssignment.unlockAt &&
          getDateFromString(localAssignment.unlockAt)?.toISOString(),
        points_possible: assignmentPoints(localAssignment.rubric),
        assignment_group_id: canvasAssignmentGroupId,
        ...groupFields(publishOptions),
      },
    };

    const response = await rateLimitAwarePost<CanvasAssignment>(url, body);
    const canvasAssignment = response.data;

    await createRubric(canvasCourseId, canvasAssignment.id, localAssignment);
    await syncStudentOverrides(
      canvasCourseId,
      canvasAssignment,
      publishOptions?.overrides ?? []
    );

    return canvasAssignment.id;
  },

  async update(
    courseId: number,
    canvasAssignmentId: number,
    localAssignment: LocalAssignment,
    settings: LocalCourseSettings,
    canvasAssignmentGroupId?: number,
    canvasLinkTargets?: CanvasLinkTargets,
    publishOptions?: CanvasAssignmentPublishOptions
  ) {
    console.log(`Updating assignment: ${localAssignment.name}`);
    const url = `${canvasApi}/courses/${courseId}/assignments/${canvasAssignmentId}`;
    const body = {
      assignment: {
        name: localAssignment.name,
        submission_types: localAssignment.submissionTypes.map((t) =>
          t.toString()
        ),
        allowed_extensions: localAssignment.allowedFileUploadExtensions.map(
          (e) => e.toString()
        ),
        description: markdownToHTMLSafe({
          markdownString: localAssignment.description,
          settings,
          replaceText: getClassroomReplaceText({
            assignment: localAssignment,
            settings,
            strict: true,
          }),
          canvasLinkTargets,
        }),
        due_at: getDateFromString(localAssignment.dueAt)?.toISOString(),
        lock_at:
          localAssignment.lockAt &&
          getDateFromString(localAssignment.lockAt)?.toISOString(),
        unlock_at:
          localAssignment.unlockAt &&
          getDateFromString(localAssignment.unlockAt)?.toISOString(),
        points_possible: assignmentPoints(localAssignment.rubric),
        assignment_group_id: canvasAssignmentGroupId,
        ...groupFields(publishOptions),
      },
    };

    const { data: canvasAssignment } = await axiosClient.put<CanvasAssignment>(
      url,
      body
    );
    await createRubric(courseId, canvasAssignmentId, localAssignment);
    await syncStudentOverrides(
      courseId,
      canvasAssignment,
      publishOptions?.overrides ?? []
    );
  },

  async getOverrides(
    courseId: number,
    canvasAssignmentId: number
  ): Promise<CanvasAssignmentOverride[]> {
    const url = `${canvasApi}/courses/${courseId}/assignments/${canvasAssignmentId}/overrides`;
    return await paginatedRequest<CanvasAssignmentOverride[]>({ url });
  },

  async delete(
    courseId: number,
    assignmentCanvasId: number,
    assignmentName: string
  ) {
    console.log(`Deleting assignment from Canvas: ${assignmentName}`);
    const url = `${canvasApi}/courses/${courseId}/assignments/${assignmentCanvasId}`;
    const response = await axiosClient.delete(url);

    if (!response.status.toString().startsWith("2")) {
      console.error(`Failed to delete assignment: ${assignmentName}`);
      throw new Error("Failed to delete assignment");
    }
  },
};

// group_category_id is sent explicitly (null clears it) so removing GroupSet
// from a file also removes the group setting in Canvas
const groupFields = (options?: CanvasAssignmentPublishOptions) => ({
  group_category_id: options?.groupCategoryId ?? null,
  grade_group_students_individually: options?.gradeIndividually ?? false,
});

// Replace the assignment's per-student overrides with the scheduled ones.
// Section overrides (no student_ids) are left alone.
const syncStudentOverrides = async (
  courseId: number,
  canvasAssignment: CanvasAssignment,
  wanted: OverrideSpec[]
) => {
  if (wanted.length === 0 && !canvasAssignment.has_overrides) return;

  const existing = await canvasAssignmentService.getOverrides(
    courseId,
    canvasAssignment.id
  );
  const studentOverrides = existing.filter(
    (o) => o.student_ids && o.student_ids.length > 0
  );
  const baseUrl = `${canvasApi}/courses/${courseId}/assignments/${canvasAssignment.id}/overrides`;

  for (const override of studentOverrides) {
    await rateLimitAwareDelete(`${baseUrl}/${override.id}`);
  }
  for (const spec of wanted) {
    await rateLimitAwarePost(baseUrl, { assignment_override: spec });
  }
  if (studentOverrides.length > 0 || wanted.length > 0)
    console.log(
      `Replaced ${studentOverrides.length} student override(s) with ${wanted.length} for ${canvasAssignment.name}`
    );
};

const createRubric = async (
  courseId: number,
  assignmentCanvasId: number,
  localAssignment: LocalAssignment
) => {
  const criterion = getRubricCriterion(localAssignment.rubric);

  const rubricBody = {
    rubric_association_id: assignmentCanvasId,
    rubric: {
      title: `Rubric for Assignment: ${localAssignment.name}`,
      association_id: assignmentCanvasId,
      association_type: "Assignment",
      use_for_grading: true,
      criteria: criterion,
    },
    rubric_association: {
      association_id: assignmentCanvasId,
      association_type: "Assignment",
      purpose: "grading",
      use_for_grading: true,
    },
  };

  const rubricUrl = `${canvasApi}/courses/${courseId}/rubrics`;
  const rubricResponse = await rateLimitAwarePost<CanvasRubricCreationResponse>(
    rubricUrl,
    rubricBody
  );

  if (!rubricResponse.data) throw new Error("Failed to create rubric");

  const assignmentPointAdjustmentUrl = `${canvasApi}/courses/${courseId}/assignments/${assignmentCanvasId}`;
  const assignmentPointAdjustmentBody = {
    assignment: { points_possible: assignmentPoints(localAssignment.rubric) },
  };

  await axiosClient.put(
    assignmentPointAdjustmentUrl,
    assignmentPointAdjustmentBody
  );
};
