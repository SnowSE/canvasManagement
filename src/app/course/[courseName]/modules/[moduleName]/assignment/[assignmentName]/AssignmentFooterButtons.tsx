import {
  EditorFooter,
  FooterAction,
} from "@/app/course/[courseName]/EditorFooter";
import { getSyncReport } from "@/app/course/[courseName]/calendar/day/getAssignmentSyncStatus";
import { ClassroomIcon, TrashIcon } from "@/components/icons/ActionIcons";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import Modal, { useModal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import {
  useCanvasAssignmentsQuery,
  useAddAssignmentToCanvasMutation,
  useDeleteAssignmentFromCanvasMutation,
  useUpdateAssignmentInCanvasMutation,
  canvasAssignmentKeys,
} from "@/features/canvas/hooks/canvasAssignmentHooks";
import { baseCanvasUrl } from "@/features/canvas/services/canvasServiceUtils";
import {
  useAssignmentQuery,
  useDeleteAssignmentMutation,
} from "@/features/local/assignments/assignmentHooks";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { getCompareUrl, getCourseUrl } from "@/services/urlUtils";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useItemNavigation } from "../../../../hooks/useItemNavigation";
import { useQueryClient } from "@tanstack/react-query";
import { Classroom50AssignmentPanel } from "./Classroom50AssignmentPanel";
import { useCanvasQuizzesQuery } from "@/features/canvas/hooks/canvasQuizHooks";
import {
  useRosterGroupSetsQuery,
  useRosterStudentsQuery,
} from "@/features/canvas/roster/rosterHooks";

export function AssignmentFooterButtons({
  moduleName,
  assignmentName,
  toggleHelp,
}: {
  assignmentName: string;
  moduleName: string;
  toggleHelp: () => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasAssignments, isFetching: canvasIsFetching } =
    useCanvasAssignmentsQuery();
  const queryClient = useQueryClient();
  const { data: assignment, isFetching } = useAssignmentQuery(
    moduleName,
    assignmentName,
  );
  const addToCanvas = useAddAssignmentToCanvasMutation();
  const deleteFromCanvas = useDeleteAssignmentFromCanvasMutation();
  const updateAssignment = useUpdateAssignmentInCanvasMutation();
  const deleteLocal = useDeleteAssignmentMutation();
  const [isLoading, setIsLoading] = useState(false);
  const { data: canvasQuizzes } = useCanvasQuizzesQuery();
  const { data: rosterStudents } = useRosterStudentsQuery();
  const { data: rosterGroupSets } = useRosterGroupSetsQuery();
  const modal = useModal();
  const classroom50Modal = useModal();
  const { previousUrl, nextUrl } = useItemNavigation(
    "assignment",
    assignmentName,
    moduleName,
  );

  const assignmentInCanvas = canvasAssignments?.find(
    (a) => a.name === assignmentName,
  );

  const anythingIsLoading =
    addToCanvas.isPending ||
    canvasIsFetching ||
    isFetching ||
    deleteFromCanvas.isPending ||
    updateAssignment.isPending;

  const differences = useMemo(
    () =>
      assignmentInCanvas
        ? getSyncReport({
            item: assignment,
            canvasItem: assignmentInCanvas,
            type: "assignment",
            settings,
            canvasLinkTargets: {
              assignments: canvasAssignments,
              quizzes: canvasQuizzes,
            },
            roster: { students: rosterStudents, groupSets: rosterGroupSets },
          }).differences.filter((d) => d.key !== "published")
        : [],
    [
      assignment,
      assignmentInCanvas,
      canvasAssignments,
      canvasQuizzes,
      rosterGroupSets,
      rosterStudents,
      settings,
    ],
  );

  const extraActions: FooterAction[] = [];
  if (settings.classroom50)
    extraActions.push({
      label: "Classroom 50",
      icon: <ClassroomIcon />,
      onClick: () => classroom50Modal.openModal(),
      opensDialog: true,
    });
  if (assignmentInCanvas)
    extraActions.push({
      label: "Delete from Canvas",
      icon: <TrashIcon />,
      danger: true,
      disabled: deleteFromCanvas.isPending,
      onClick: () =>
        deleteFromCanvas.mutate({
          canvasAssignmentId: assignmentInCanvas.id,
          assignmentName: assignment.name,
        }),
    });
  else
    extraActions.push({
      label: "Delete locally",
      icon: <TrashIcon />,
      danger: true,
      onClick: () => modal.openModal(),
      opensDialog: true,
    });

  return (
    <EditorFooter
      type="assignment"
      name={assignmentName}
      moduleName={moduleName}
      canvasLoading={canvasAssignments === undefined}
      canvasItem={assignmentInCanvas}
      differences={differences}
      canvasUrl={
        assignmentInCanvas &&
        `${baseCanvasUrl}/courses/${settings.canvasId}/assignments/${assignmentInCanvas.id}`
      }
      compareUrl={getCompareUrl(
        courseName,
        moduleName,
        "assignment",
        assignmentName,
      )}
      busy={anythingIsLoading}
      onAdd={() => addToCanvas.mutate({ assignment, moduleName })}
      onUpdate={() =>
        assignmentInCanvas &&
        updateAssignment.mutate({
          canvasAssignmentId: assignmentInCanvas.id,
          assignment,
        })
      }
      onViewInCanvas={() => {
        // Canvas edits made in the new tab show up here without a reload
        for (let i = 1; i <= 8; i += 2) {
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: canvasAssignmentKeys.assignments(settings.canvasId),
            });
          }, i * 1000);
        }
      }}
      extraActions={extraActions}
      toggleHelp={toggleHelp}
      previousUrl={previousUrl}
      nextUrl={nextUrl}
    >
      {settings.classroom50 && (
        <Modal modalControl={classroom50Modal} modalWidth="w-1/2">
          {() => (
            <Classroom50AssignmentPanel
              moduleName={moduleName}
              assignmentName={assignmentName}
            />
          )}
        </Modal>
      )}
      <Modal modalControl={modal} modalWidth="w-1/5">
        {({ closeModal }) => (
          <div>
            <div className="text-center">
              Are you sure you want to delete this assignment locally?
            </div>
            <br />
            <div className="flex justify-around gap-3">
              <button
                onClick={async () => {
                  navigate({ to: getCourseUrl(courseName) });
                  setIsLoading(true);
                  await deleteLocal.mutateAsync({
                    moduleName,
                    assignmentName,
                    courseName,
                  });
                  router.invalidate();
                  // setIsLoading(false); //refreshing the router will make spinner go away
                }}
                disabled={deleteLocal.isPending || isLoading}
                className="btn-danger"
              >
                Yes
              </button>
              <button
                onClick={closeModal}
                disabled={deleteLocal.isPending || isLoading}
              >
                No
              </button>
            </div>
            {(deleteLocal.isPending || isLoading) && <Spinner />}
          </div>
        )}
      </Modal>
    </EditorFooter>
  );
}
