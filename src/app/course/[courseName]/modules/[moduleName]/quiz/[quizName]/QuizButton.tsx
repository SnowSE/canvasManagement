import {
  EditorFooter,
  FooterAction,
} from "@/app/course/[courseName]/EditorFooter";
import { getSyncReport } from "@/app/course/[courseName]/calendar/day/getAssignmentSyncStatus";
import { TrashIcon } from "@/components/icons/ActionIcons";
import { useCanvasAssignmentsQuery } from "@/features/canvas/hooks/canvasAssignmentHooks";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import Modal, { useModal } from "@/components/Modal";
import {
  useCanvasQuizzesQuery,
  useAddQuizToCanvasMutation,
  useDeleteQuizFromCanvasMutation,
  useUpdateQuizInCanvasMutation,
} from "@/features/canvas/hooks/canvasQuizHooks";
import { baseCanvasUrl } from "@/features/canvas/services/canvasServiceUtils";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import {
  useDeleteQuizMutation,
  useQuizQuery,
} from "@/features/local/quizzes/quizHooks";
import { getCompareUrl, getCourseUrl } from "@/services/urlUtils";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useItemNavigation } from "../../../../hooks/useItemNavigation";

export function QuizButtons({
  moduleName,
  quizName,
  toggleHelp,
}: {
  quizName: string;
  moduleName: string;
  toggleHelp: () => void;
}) {
  const navigate = useNavigate();
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasQuizzes } = useCanvasQuizzesQuery();
  const { data: canvasAssignments } = useCanvasAssignmentsQuery();

  const { data: quiz } = useQuizQuery(moduleName, quizName);
  const addToCanvas = useAddQuizToCanvasMutation();
  const deleteFromCanvas = useDeleteQuizFromCanvasMutation();
  const updateInCanvas = useUpdateQuizInCanvasMutation();
  const deleteLocal = useDeleteQuizMutation();
  const modal = useModal();
  const { previousUrl, nextUrl } = useItemNavigation(
    "quiz",
    quizName,
    moduleName,
  );

  const quizInCanvas = canvasQuizzes?.find((c) => c.title === quizName);

  const differences = useMemo(
    () =>
      quizInCanvas
        ? getSyncReport({
            item: quiz,
            canvasItem: quizInCanvas,
            type: "quiz",
            settings,
            canvasLinkTargets: {
              assignments: canvasAssignments,
              quizzes: canvasQuizzes,
            },
          }).differences.filter((d) => d.key !== "published")
        : [],
    [canvasAssignments, canvasQuizzes, quiz, quizInCanvas, settings],
  );

  const extraActions: FooterAction[] = quizInCanvas
    ? [
        {
          label: "Delete from Canvas",
          icon: <TrashIcon />,
          danger: true,
          disabled: deleteFromCanvas.isPending,
          onClick: () => deleteFromCanvas.mutate(quizInCanvas.id),
        },
      ]
    : [
        {
          label: "Delete locally",
          icon: <TrashIcon />,
          danger: true,
          onClick: () => modal.openModal(),
          opensDialog: true,
        },
      ];

  return (
    <EditorFooter
      type="quiz"
      name={quizName}
      moduleName={moduleName}
      canvasLoading={canvasQuizzes === undefined}
      canvasItem={
        quizInCanvas && {
          id: quizInCanvas.id,
          published: quizInCanvas.published === true,
        }
      }
      differences={differences}
      canvasUrl={
        quizInCanvas &&
        `${baseCanvasUrl}/courses/${settings.canvasId}/quizzes/${quizInCanvas.id}`
      }
      compareUrl={getCompareUrl(courseName, moduleName, "quiz", quizName)}
      busy={
        addToCanvas.isPending ||
        deleteFromCanvas.isPending ||
        updateInCanvas.isPending
      }
      onAdd={() => addToCanvas.mutate({ quiz, moduleName })}
      onUpdate={() =>
        quizInCanvas &&
        updateInCanvas.mutate({ quiz, canvasQuizId: quizInCanvas.id })
      }
      updateTitle="Pushes settings and replaces the questions in Canvas with the file's. On a published quiz, click Save it now in Canvas afterwards so students get them. Warns first if students have started."
      extraActions={extraActions}
      toggleHelp={toggleHelp}
      previousUrl={previousUrl}
      nextUrl={nextUrl}
    >
      <Modal modalControl={modal} modalWidth="w-1/5">
        {({ closeModal }) => (
          <div>
            <div className="text-center">
              Are you sure you want to delete this quiz locally?
            </div>
            <br />
            <div className="flex justify-around gap-3">
              <button
                onClick={async () => {
                  await deleteLocal.mutateAsync({
                    moduleName,
                    quizName,
                    courseName,
                  });
                  navigate({ to: getCourseUrl(courseName) });
                }}
                className="btn-danger"
              >
                Yes
              </button>
              <button onClick={closeModal}>No</button>
            </div>
          </div>
        )}
      </Modal>
    </EditorFooter>
  );
}
