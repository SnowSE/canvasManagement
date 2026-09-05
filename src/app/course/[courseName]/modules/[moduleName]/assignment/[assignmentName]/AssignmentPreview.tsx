import MarkdownDisplay from "@/components/MarkdownDisplay";
import { LocalAssignment } from "@/features/local/assignments/models/localAssignment";
import { getClassroomReplaceText } from "@/features/local/classroom50/classroom50UrlUtils";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { RubricItem, rubricItemIsExtraCredit } from "@/features/local/assignments/models/rubricItem";
import { assignmentPoints } from "@/features/local/assignments/models/utils/assignmentPointsUtils";
import { formatHumanReadableDate } from "@/services/utils/dateFormat";
import React, { Fragment } from "react";
import {
  scheduledDueDate,
  studentDisplayName,
} from "@/features/local/assignments/models/utils/scheduleUtils";
import { useRosterStudentsQuery } from "@/features/canvas/roster/rosterHooks";

function RubricItemRow({ rubricItem }: { rubricItem: RubricItem }) {
  const isExtraCredit = rubricItemIsExtraCredit(rubricItem);
  return (
    <Fragment>
      <div className="text-end pe-1 font-medium">
        {isExtraCredit ? "Extra Credit" : ""}
      </div>
      <div className="text-end pe-3 font-medium">{rubricItem.points}</div>
      <div className="font-medium">{rubricItem.label}</div>
      {rubricItem.ratings?.map((rating, j) => (
        <Fragment key={j}>
          <div />
          <div className="text-end pe-3 ps-6 text-sm text-gray-400">
            {rating.points}
          </div>
          <div className="text-sm text-gray-400">{rating.description}</div>
        </Fragment>
      ))}
    </Fragment>
  );
}

export default function AssignmentPreview({
  assignment,
}: {
  assignment: LocalAssignment;
}) {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: roster } = useRosterStudentsQuery();
  const totalPoints = assignmentPoints(assignment.rubric);
  const extraPoints = assignment.rubric.reduce(
    (sum, cur) => (rubricItemIsExtraCredit(cur) ? sum + cur.points : sum),
    0
  );
  return (
    <div className="h-full overflow-y-auto ">
      <section>
        <div className="flex">
          <div className="flex-1 text-end pe-3">Unlock Date</div>
          <div className="flex-1">
            {assignment.unlockAt &&
              formatHumanReadableDate(assignment.unlockAt)}
          </div>
        </div>
        <div className="flex">
          <div className="flex-1 text-end pe-3">Due Date</div>
          <div className="flex-1">
            {formatHumanReadableDate(assignment.dueAt)}
          </div>
        </div>
        <div className="flex">
          <div className="flex-1 text-end pe-3">Lock Date</div>
          <div className="flex-1">
            {assignment.lockAt && formatHumanReadableDate(assignment.lockAt)}
          </div>
        </div>
        <div className="flex">
          <div className="flex-1 text-end pe-3">Assignment Group Name</div>
          <div className="flex-1">{assignment.localAssignmentGroupName}</div>
        </div>
        {assignment.groupSet && (
          <div className="flex">
            <div className="flex-1 text-end pe-3">Group Set</div>
            <div className="flex-1">
              {assignment.groupSet}
              <span className="text-gray-400">
                {assignment.gradeIndividually
                  ? " · each member graded individually"
                  : " · one grade per group"}
              </span>
            </div>
          </div>
        )}
        {assignment.schedule && assignment.schedule.length > 0 && (
          <div className="flex">
            <div className="flex-1 text-end pe-3">Schedule</div>
            <div className="flex-1">
              {assignment.schedule.map((entry) => (
                <div key={entry.date}>
                  <span className="font-medium">
                    {formatHumanReadableDate(
                      scheduledDueDate(entry.date, assignment.dueAt)
                    )}
                  </span>
                  <span className="text-gray-400">
                    {entry.students.length > 0
                      ? " · " +
                        entry.students
                          .map((t) => studentDisplayName(t, roster?.students))
                          .join("; ")
                      : " · no students yet"}
                  </span>
                </div>
              ))}
              <div className="text-gray-400 text-sm">
                everyone else: {formatHumanReadableDate(assignment.dueAt)}
              </div>
            </div>
          </div>
        )}
        <div className="flex">
          <div className="flex-1 text-end pe-3">Submission Types</div>
          <div className="flex-1">
            <ul className="">
              {assignment.submissionTypes.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex">
          <div className="flex-1 text-end pe-3">File Upload Types</div>
          <div className="flex-1">
            <ul className="">
              {assignment.allowedFileUploadExtensions.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <br />
      <hr />
      <br />
      <section>
        <MarkdownDisplay
          markdown={assignment.description}
          replaceText={getClassroomReplaceText({ assignment, settings })}
        />
      </section>
      <hr />
      <section>
        <h2 className="text-center">Rubric - {totalPoints} Points</h2>
        {extraPoints !== 0 && (
          <h5 className="text-center">{extraPoints} Extra Credit Points</h5>
        )}
        <div className="grid grid-cols-[auto_auto_1fr]">
          {assignment.rubric.map((rubricItem, i) => (
            <RubricItemRow key={rubricItem.label + i} rubricItem={rubricItem} />
          ))}
        </div>
      </section>
    </div>
  );
}
