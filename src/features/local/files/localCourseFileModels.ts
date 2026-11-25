import { validateFileName } from "@/services/fileNameValidation";

/**
 * A file of a module (an HTML demo, an SVG drawing, a stylesheet, a PDF:
 * any file), kept in the module's `files` folder as it is, for pages and
 * other files to link to or use. It has no settings: what puts it in front
 * of students is a page that links to it. Canvas gets the file itself,
 * never a rendering, and only when it is added there.
 */
export const filesFolder = "files";

/** A module's file as its list has it: without its text (a demo can be half a megabyte), with its length and a hash of it, to tell whether Canvas has it as it is. */
export interface LocalCourseFileListed {
  name: string;
  hash: string;
  /** Its length in bytes. */
  size: number;
}

/** A file as the editor opens it: its text, and whether it is text at all (the editor never writes one that isn't). */
export type CourseFile = { name: string; text: string; isText: boolean };

/** Whether a name in a files folder is a course file's: any is, but a hidden file. */
export const isCourseFileName = (name: string) => name !== "" && !name.startsWith(".");

/** Why a course file can't have this name, or "" when it can. */
export const fileNameProblem = (name: string) => validateFileName(name) || (isCourseFileName(name) ? "" : "A file's name can't start with a dot");
