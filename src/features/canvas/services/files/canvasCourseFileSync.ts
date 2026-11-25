import fs from "fs/promises";
import path from "path";
import { TRPCError } from "@trpc/server";
import { fileStorageService } from "@/features/local/utils/fileStorageService";
import { courseFileOnDisk, courseFileStorage } from "@/features/local/files/courseFileStorage";
import { courseFilePath } from "@/services/courseFileLinks";
import { uploadToCanvasPart1, uploadToCanvasPart2 } from "./canvasFileService";
import { canvasCourseFileService } from "./canvasCourseFileService";

/** A Canvas file as the caller found it (see canvasFileOf): its id, and whether it is locked. */
type Found = { id: number; locked: boolean };

/**
 * Add to Canvas and Update in Canvas for one of the course's files, named
 * by its place in the course (`<module>/files/<name>`). It goes into the
 * Canvas folder of the same place, so the relative addresses in it (a
 * stylesheet beside it, another module's script) find the same files there
 * as on disk, with nothing in it changed, and it is found again by that
 * place: nothing about it is kept here.
 *
 * Who can see it stays as it was: Canvas shows an upload to every student
 * at once, so a file new to Canvas is locked straight away (unpublished,
 * as any new item is, until it is published), and one that replaces a copy
 * is left with that copy's lock: the copy at its place (`inCanvas`), or the
 * copy it was before it was moved here (`movedFrom`), which is then deleted
 * so no copy is left behind. Returns the Canvas file's id.
 */
export const uploadCourseFile = async ({
  courseName,
  path: relative,
  inCanvas,
  movedFrom,
}: {
  courseName: string;
  path: string;
  inCanvas?: Found;
  movedFrom?: Found;
}) => {
  const settings = await fileStorageService.settings.getCourseSettingsByName(courseName);
  const localPath = await courseFileOnDisk(courseName, relative)
    .then(async (file) => (await fs.access(file), file))
    .catch((e: Error) => {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Not sent to Canvas: ${relative} is not there (${e.message})` });
    });
  const { upload_url, upload_params } = await uploadToCanvasPart1(localPath, settings.canvasId, path.posix.dirname(relative));
  const { id } = await uploadToCanvasPart2({ pathToUpload: localPath, upload_url, upload_params });
  await canvasCourseFileService.setLocked(id, (inCanvas ?? movedFrom)?.locked ?? true);
  if (movedFrom && movedFrom.id !== id) await canvasCourseFileService.delete(movedFrom.id);
  return id;
};

/**
 * Rename, as for any item: the file on disk,
 * and in Canvas where it is (`canvasFileId`), so it stays the Canvas file
 * it was, with its links and its lock.
 */
export const renameCourseFile = async ({
  courseName,
  moduleName,
  name,
  newName,
  canvasFileId,
}: {
  courseName: string;
  moduleName: string;
  name: string;
  newName: string;
  canvasFileId?: number;
}) => {
  await courseFileOnDisk(courseName, courseFilePath(moduleName, name));
  await courseFileStorage.place({ courseName, from: { moduleName, name }, to: { moduleName, name: newName } });
  if (canvasFileId) await canvasCourseFileService.rename(canvasFileId, newName);
};
