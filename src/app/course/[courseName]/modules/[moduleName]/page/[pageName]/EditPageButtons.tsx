import {
  EditorFooter,
  FooterAction,
} from "@/app/course/[courseName]/EditorFooter";
import { TrashIcon } from "@/components/icons/ActionIcons";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import Modal, { useModal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import {
  useCanvasPagesQuery,
  useCreateCanvasPageMutation,
  useUpdateCanvasPageMutation,
  useDeleteCanvasPageMutation,
} from "@/features/canvas/hooks/canvasPageHooks";
import { baseCanvasUrl } from "@/features/canvas/services/canvasServiceUtils";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import {
  useDeletePageMutation,
  usePageQuery,
} from "@/features/local/pages/pageHooks";
import { getCourseUrl } from "@/services/urlUtils";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useItemNavigation } from "../../../../hooks/useItemNavigation";

export default function EditPageButtons({
  moduleName,
  pageName,
}: {
  pageName: string;
  moduleName: string;
}) {
  const navigate = useNavigate();
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: page } = usePageQuery(moduleName, pageName);
  const { data: canvasPages } = useCanvasPagesQuery();
  const createPageInCanvas = useCreateCanvasPageMutation();
  const updatePageInCanvas = useUpdateCanvasPageMutation();
  const deletePageInCanvas = useDeleteCanvasPageMutation();
  const deletePageLocal = useDeletePageMutation();
  const modal = useModal();
  const [loading, setLoading] = useState(false);
  const { previousUrl, nextUrl } = useItemNavigation(
    "page",
    pageName,
    moduleName,
  );

  const pageInCanvas = canvasPages?.find((p) => p.title === pageName);

  const requestIsPending =
    createPageInCanvas.isPending ||
    updatePageInCanvas.isPending ||
    deletePageInCanvas.isPending;

  const extraActions: FooterAction[] = pageInCanvas
    ? [
        {
          label: "Delete from Canvas",
          icon: <TrashIcon />,
          danger: true,
          disabled: requestIsPending,
          onClick: () => deletePageInCanvas.mutate(pageInCanvas.page_id),
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
      type="page"
      name={pageName}
      moduleName={moduleName}
      canvasLoading={canvasPages === undefined}
      canvasItem={
        pageInCanvas && {
          id: pageInCanvas.page_id,
          published: pageInCanvas.published,
        }
      }
      canvasUrl={
        pageInCanvas &&
        `${baseCanvasUrl}/courses/${settings.canvasId}/pages/${pageInCanvas.url}`
      }
      busy={requestIsPending}
      onAdd={() => createPageInCanvas.mutate({ page, moduleName })}
      onUpdate={() =>
        pageInCanvas &&
        updatePageInCanvas.mutate({
          page,
          canvasPageId: pageInCanvas.page_id,
        })
      }
      extraActions={extraActions}
      previousUrl={previousUrl}
      nextUrl={nextUrl}
    >
      <Modal modalControl={modal} modalWidth="w-1/5">
        {({ closeModal }) => (
          <div>
            <div className="text-center">
              Are you sure you want to delete this page locally?
            </div>
            <br />
            <div className="flex justify-around gap-3">
              <button
                onClick={async () => {
                  setLoading(true);
                  await deletePageLocal.mutateAsync({
                    moduleName,
                    pageName,
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
            {loading && <Spinner />}
          </div>
        )}
      </Modal>
    </EditorFooter>
  );
}
