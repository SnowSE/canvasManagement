import { CanvasFile } from "@/features/canvas/services/files/canvasCourseFileService";
import { courseFileFor } from "@/services/courseFileLinks";
import { baseCanvasUrl } from "@/services/urlUtils";
import type { ItemSyncStatus } from "@/app/course/[courseName]/calendar/day/getAssignmentSyncStatus";

/**
 * A course's file in Canvas: the Canvas file at the same place (Canvas's
 * folders mirror the modules' files folders, see uploadCourseFile). Nothing
 * is kept about it here: Canvas is asked.
 */
export const canvasFileOf = (path: string, canvasFiles: CanvasFile[] | undefined) => canvasFiles?.find((f) => f.path === path);

/** The address that opens a course's file in Canvas: an HTML file with its scripts running, an SVG as an image. */
export const canvasFileUrl = (canvasCourseId: number, canvasFileId: number) => `${baseCanvasUrl}/courses/${canvasCourseId}/files/${canvasFileId}/download`;

/**
 * The settings an item is rendered with for Canvas, with the address of
 * each of the course's files that Canvas has, so a link to one finds it
 * (see markdownToHTMLSafe). For rendering only: never saved.
 */
export const withCanvasFiles = <T extends { canvasId: number; assets: { sourceUrl: string; canvasUrl: string }[] }>(
  settings: T,
  canvasFiles: CanvasFile[] | undefined,
): T => {
  if (!canvasFiles) return settings;
  const addresses = canvasFiles.map((f) => ({ sourceUrl: f.path, canvasUrl: canvasFileUrl(settings.canvasId, f.id) }));
  return { ...settings, assets: [...settings.assets, ...addresses] };
};

/**
 * What sending the file at `path` to Canvas replaces there (see
 * uploadCourseFile): the copy at its place (`inCanvas`); or, with none
 * there, the Canvas file this browser remembers sending it as (`sent`), if
 * Canvas still has that one, which is the copy at the place it was moved
 * from (`movedFrom`); or nothing, for a file new to Canvas.
 */
export const sendingOf = (path: string, canvasFiles: CanvasFile[] | undefined, sent: { id: number } | undefined) => {
  const found = (file: CanvasFile | undefined) => file && { id: file.id, locked: file.locked };
  const inCanvas = found(canvasFileOf(path, canvasFiles));
  const movedFrom = inCanvas ? undefined : found(canvasFiles?.find((f) => f.id === sent?.id));
  return { ...(inCanvas && { inCanvas }), ...(movedFrom && { movedFrom }) };
};

/**
 * Why an item with these links to course files (see linkedFiles) can't be
 * sent to Canvas yet, or nothing when it can: every link has to name one
 * file of the course (`paths`), and Canvas has to have it.
 */
export const unsendableLinks = (links: string[], paths: string[], canvasFiles: CanvasFile[]) => {
  const unknown = links.filter((link) => !courseFileFor(link, paths));
  const missing = links.flatMap((link) => courseFileFor(link, paths) ?? []).filter((path) => !canvasFileOf(path, canvasFiles));
  if (unknown.length)
    return `it links to ${unknown.join(", ")}, which ${unknown.length === 1 ? "is" : "are"} not one file of the course: check the name, or, where two modules have a file of that name, say which in the link (../../<module>/files/<name>).`;
  if (missing.length)
    return `it links to ${missing.join(", ")}, not in Canvas yet, so the link would lead nowhere there. Add ${missing.length === 1 ? "that file" : "those files"} to Canvas first (each is in the Modules pane), then publish this.`;
  return undefined;
};

/**
 * How a file stands against Canvas. Canvas has the file itself and doesn't
 * say what is in it, so its contents are compared by what this browser
 * remembers sending (`sent`: that Canvas file's id and the hash it had),
 * and where it remembers nothing of this Canvas file (it was sent from
 * elsewhere, or replaced in Canvas since) by length. A locked file is
 * unpublished: students can't open it, by its link either.
 */
export function fileSyncStatus({
  hash,
  size,
  canvasFile,
  sent,
}: {
  hash: string;
  size: number;
  canvasFile?: CanvasFile;
  sent?: { id: number; hash: string };
}): ItemSyncStatus {
  if (!canvasFile) return { status: "localOnly", message: "not in canvas", differences: [] };
  const same = sent?.id === canvasFile.id ? sent.hash === hash : canvasFile.size === size;
  const differences = same
    ? []
    : [
        {
          key: "contents",
          label: "Contents",
          section: "description" as const,
          local: "edited since it was sent",
          canvas: "as sent",
          same,
          message: "edited since it was sent to canvas",
        },
      ];
  const unpublished = canvasFile.locked;
  return {
    status: differences.length > 0 || unpublished ? "incomplete" : "published",
    message: differences[0]?.message ?? (unpublished ? "not published in canvas" : ""),
    differences,
    unpublished,
  };
}
