"use client";
import { FC } from "react";
import Modal, { ModalControl } from "@/components/Modal";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useRemoveFileMutation } from "@/features/local/files/fileHooks";
import { useCreatePageMutation, usePagesQueries } from "@/features/local/pages/pageHooks";
import { useNavigate } from "@tanstack/react-router";
import { getModuleItemUrl } from "@/services/urlUtils";
import { useCanvasFilesQuery, useDeleteCanvasFileMutation, useSendFileToCanvasMutation } from "@/features/canvas/hooks/canvasCourseFileHooks";
import { dateToMarkdownString } from "@/features/local/utils/timeUtils";
import { courseFilePath, pageLinkingTo } from "@/services/courseFileLinks";
import { useCourseContext } from "../../../context/courseContext";
import { PublishInCanvasButton } from "../../../PublishInCanvasButton";
import { canvasFileOf, canvasFileUrl } from "@/features/canvas/services/files/fileSyncStatus";
import type { FileItem } from "./fileKind";

/**
 * A file's right-click menu: what the other items' menus have (add to
 * Canvas or update, publish, view, delete), and Make a page for it: a file
 * is on no day and in no Canvas module, so what puts it before students is
 * a page of its module that links to it (see pageLinkingTo), dated today
 * to be dragged to its day. A page of that name already there is opened,
 * never written over.
 */
export const FileContextMenu: FC<{ modalControl: ModalControl; item: IModuleItem; moduleName: string }> = ({ modalControl, item, moduleName }) => {
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasFiles } = useCanvasFilesQuery();
  const navigate = useNavigate();
  const { data: pages } = usePagesQueries(moduleName);
  const createPage = useCreatePageMutation();
  const send = useSendFileToCanvasMutation();
  const deleteInCanvas = useDeleteCanvasFileMutation();
  const removeLocal = useRemoveFileMutation();
  const here = { moduleName, name: item.name };
  const path = courseFilePath(moduleName, item.name);
  const canvasFile = canvasFileOf(path, canvasFiles);
  const today = () => {
    const now = new Date();
    now.setHours(settings.defaultDueTime.hour, settings.defaultDueTime.minute, 0, 0);
    return dateToMarkdownString(now);
  };
  const act = (action: () => void) => () => {
    action();
    modalControl.closeModal();
  };
  const button = "unstyled block font-bold text-left py-1 px-3 hover:bg-blue-900 disabled:opacity-50 bg-blue-900/50 text-blue-50 border border-blue-800/70 rounded";
  const danger = "unstyled font-bold text-left py-1 px-3 bg-rose-900/30 hover:bg-rose-950 text-rose-50 border border-rose-900/40 rounded";
  const sendIt = act(() => send.mutate({ path, hash: (item as FileItem).hash }));
  const makePage = async () => {
    const page = pageLinkingTo(item.name);
    if (!pages.some((p) => p.name === page.name)) await createPage.mutateAsync({ courseName, moduleName, pageName: page.name, page: { ...page, dueAt: today() } });
    modalControl.closeModal();
    navigate({ to: getModuleItemUrl(courseName, moduleName, "page", page.name) });
  };
  return (
    <Modal modalControl={modalControl} backgroundCoverColor="bg-black/30">
      {() => (
        <div className="flex flex-col gap-2 p-2 text-sm">
          {canvasFile ? (
            <>
              <a href={canvasFileUrl(settings.canvasId, canvasFile.id)} target="_blank" rel="noreferrer" className={button} onClick={modalControl.closeModal}>
                View in Canvas
              </a>
              <button className={button} onClick={sendIt}>
                Update in Canvas
              </button>
              <PublishInCanvasButton type="file" canvasItemId={canvasFile.id} published={!canvasFile.locked} name={item.name} moduleName={moduleName} onPublish={modalControl.closeModal} className={button} publishedClassName="text-left py-1" />
              <button className={danger} onClick={act(() => deleteInCanvas.mutate(canvasFile.id))}>
                Delete from Canvas
              </button>
            </>
          ) : (
            <>
              <button className={button} disabled={canvasFiles === undefined} onClick={sendIt}>
                Add to Canvas
              </button>
              <button className={danger} onClick={act(() => window.confirm(`Delete ${item.name} from the module's files?`) && removeLocal.mutate({ courseName, ...here }))}>
                Delete locally
              </button>
            </>
          )}
          <button className={button} disabled={createPage.isPending} title={`A page in ${moduleName} that links to ${item.name}: the page is what has a day and a place in Canvas's module`} onClick={makePage}>
            Make a page for it
          </button>
        </div>
      )}
    </Modal>
  );
};
