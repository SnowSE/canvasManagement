"use client";
import { useNavigate } from "@tanstack/react-router";
import { EditorFooter, FooterAction } from "@/app/course/[courseName]/EditorFooter";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { TrashIcon } from "@/components/icons/ActionIcons";
import { useCanvasFilesQuery, useDeleteCanvasFileMutation, useSendFileToCanvasMutation } from "@/features/canvas/hooks/canvasCourseFileHooks";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useFilesQueries, useRemoveFileMutation } from "@/features/local/files/fileHooks";
import { getCourseUrl } from "@/services/urlUtils";
import { courseFilePath } from "@/services/courseFileLinks";
import { canvasFileOf, canvasFileUrl, fileSyncStatus } from "@/features/canvas/services/files/fileSyncStatus";
import { sentFiles } from "@/features/canvas/hooks/sentFiles";

/**
 * A file's footer: where it stands against Canvas, and Add to Canvas,
 * Update in Canvas and Publish, as any item has. It is in no Canvas module
 * and on no day: a page that links to it is (see pageLinkingTo).
 */
export function FileFooter({ name, moduleName }: { name: string; moduleName: string }) {
  const { courseName } = useCourseContext();
  const navigate = useNavigate();
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: canvasFiles } = useCanvasFilesQuery();
  const { data: files } = useFilesQueries(moduleName);
  const send = useSendFileToCanvasMutation();
  const deleteInCanvas = useDeleteCanvasFileMutation();
  const removeLocal = useRemoveFileMutation();

  const path = courseFilePath(moduleName, name);
  const canvasFile = canvasFileOf(path, canvasFiles);
  const { hash = "", size = 0 } = files.find((f) => f.name === name) ?? {};
  const { differences } = fileSyncStatus({ hash, size, canvasFile, sent: sentFiles.recall(settings.canvasId, path) });
  const busy = send.isPending || deleteInCanvas.isPending;
  const sendIt = () => send.mutate({ path, hash });
  const remove: FooterAction = canvasFile
    ? { label: "Delete from Canvas", icon: <TrashIcon />, danger: true, disabled: busy, onClick: () => deleteInCanvas.mutate(canvasFile.id) }
    : {
        label: "Delete locally",
        icon: <TrashIcon />,
        danger: true,
        onClick: async () => {
          if (!window.confirm(`Delete ${name} from the module's files?`)) return;
          await removeLocal.mutateAsync({ courseName, moduleName, name });
          navigate({ to: getCourseUrl(courseName) });
        },
      };

  return (
    <EditorFooter
      type="file"
      name={name}
      moduleName={moduleName}
      canvasLoading={canvasFiles === undefined}
      canvasItem={canvasFile && { id: canvasFile.id, published: !canvasFile.locked }}
      canvasUrl={canvasFile && canvasFileUrl(settings.canvasId, canvasFile.id)}
      differences={differences}
      busy={busy}
      onAdd={sendIt}
      onUpdate={sendIt}
      extraActions={[remove]}
      previousUrl={null}
      nextUrl={null}
    />
  );
}
