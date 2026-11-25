import { axiosClient } from "@/services/axiosUtils";
import { canvasApi, paginatedRequest } from "../canvasServiceUtils";
import { rateLimitAwareDelete } from "../canvasWebRequestUtils";

/** A file of a course's Canvas files, as far as the app reads it. */
export interface CanvasFile {
  id: number;
  display_name: string;
  /** Its place in the course's files: its folders' names and its own, as a course file's place is on disk (`Week 1/files/koans.html`). */
  path: string;
  /** Its length in bytes: all Canvas says of what is in it. */
  size: number;
  /** Students can't open it, in the course's Files or by its address: what an unpublished file is. */
  locked: boolean;
}

/** A Canvas file's place from its folder's full name, which starts at the course's own folder (`course files/Week 1/files`). */
export const placeInCourseFiles = (folderFullName: string, name: string) => [...folderFullName.split("/").slice(1), name].join("/");

export const canvasCourseFileService = {
  /** Every file of the course's Canvas files, each with its place (Canvas gives a file its folder's id, and each folder its full name). */
  async getAll(canvasCourseId: number): Promise<CanvasFile[]> {
    const [files, folders] = await Promise.all([
      paginatedRequest<(Omit<CanvasFile, "path"> & { folder_id: number })[]>({ url: `${canvasApi}/courses/${canvasCourseId}/files` }),
      paginatedRequest<{ id: number; full_name: string }[]>({ url: `${canvasApi}/courses/${canvasCourseId}/folders` }),
    ]);
    return files.map((f) => ({ ...f, path: placeInCourseFiles(folders.find((d) => d.id === f.folder_id)?.full_name ?? "", f.display_name) }));
  },

  /** Locks a file (unpublished) or unlocks it (published). */
  async setLocked(canvasFileId: number, locked: boolean) {
    await axiosClient.put(`${canvasApi}/files/${canvasFileId}`, { locked });
  },

  /** Renames a file where it is: it stays the same Canvas file, with its links and its lock. */
  async rename(canvasFileId: number, name: string) {
    await axiosClient.put(`${canvasApi}/files/${canvasFileId}`, { name });
  },

  delete: (canvasFileId: number) => rateLimitAwareDelete(`${canvasApi}/files/${canvasFileId}`),
};
