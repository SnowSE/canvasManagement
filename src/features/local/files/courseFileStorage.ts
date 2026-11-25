import fs from "fs/promises";
import crypto from "crypto";
import path from "path";
import { TRPCError } from "@trpc/server";
import { getCoursePathByName } from "../globalSettings/globalSettingsFileStorageService";
import { getModuleNamesFromFiles } from "../modules/moduleRouter";
import { directoryOrFileExists } from "../utils/fileSystemUtils";
import { usedFiles } from "@/services/courseFileLinks";
import { CourseFile, fileNameProblem, filesFolder, isCourseFileName, LocalCourseFileListed } from "./localCourseFileModels";

/**
 * Where a course's files are kept: each module's `files` folder, and nowhere
 * else. A file kept anywhere else (a starter project, a page's folder) is
 * no file of the course.
 */
const filesFolders = async (courseName: string) => {
  const root = await getCoursePathByName(courseName);
  // whole paths: a course's own is relative to where the server runs
  const folders = (await getModuleNamesFromFiles(courseName)).map((moduleName) => path.resolve(root, moduleName, filesFolder));
  return (await Promise.all(folders.map(async (dir) => ((await directoryOrFileExists(dir)) ? [dir] : [])))).flat();
};

/** Where previews find the course's files, with the key that opens it (see the course-file route): new each time the server starts. */
export const previewBase = `/course-file/${crypto.randomBytes(16).toString("hex")}`;

const hashes = new Map<string, { stamp: string; hash: string }>();

/**
 * What a file's contents are known by: its length, which is all Canvas
 * says of its copy, and a hash, to tell an edit that left the length as it
 * was. The hash is kept per file while its size and date stand, so listing
 * a module doesn't read a large file again each time.
 */
const fingerprintOf = async (file: string) => {
  const { size, mtimeMs } = await fs.stat(file);
  const stamp = `${size}/${mtimeMs}`;
  const known = hashes.get(file);
  const hash = known?.stamp === stamp ? known.hash : crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex").slice(0, 16);
  hashes.set(file, { stamp, hash });
  return { hash, size };
};

/**
 * A file's text, for the editor. One that isn't text (an image, a PDF:
 * there is a zero byte near its start) has none, and `isText` says so.
 * Undefined: there is no such file.
 */
const readText = async (file: string) => {
  const handle = await fs.open(file).catch((e) => {
    if (e.code === "ENOENT") return undefined;
    throw e;
  });
  if (!handle) return undefined;
  try {
    const start = Buffer.alloc(8000);
    const { bytesRead } = await handle.read(start, 0, start.length, 0);
    if (start.subarray(0, bytesRead).includes(0)) return { text: "", isText: false };
    return { text: (await handle.readFile("utf-8")).replace(/\r\n/g, "\n"), isText: true };
  } finally {
    await handle.close();
  }
};

type InModule = { courseName: string; moduleName: string; name: string };
const folderOf = async ({ courseName, moduleName }: Omit<InModule, "name">) => path.join(await getCoursePathByName(courseName), moduleName, filesFolder);

const pathOf = async (item: InModule) => {
  const problem = fileNameProblem(item.name);
  if (problem) throw new Error(`${item.name}: ${problem}`);
  return path.join(await folderOf(item), item.name);
};

const inCourse = (root: string, file: string) => path.relative(root, file).split(path.sep).join("/");

/** A course file's place on disk, from its place in the course (`<module>/files/<name>`): a file of a module's files folder, or an error. */
export const courseFileOnDisk = async (courseName: string, relative: string) => {
  const root = await getCoursePathByName(courseName);
  const file = path.resolve(root, relative);
  if (relative !== inCourse(root, file) || !isCourseFileName(path.basename(file)) || !(await filesFolders(courseName)).includes(path.dirname(file)))
    throw new Error(`${relative} is not a file of ${courseName}.`);
  return file;
};

/** The files of a course on disk (see localCourseFileModels): every file of a module's files folder is that module's. */
export const courseFileStorage = {
  /** A module's files as its list shows them. */
  async inModule(module: Omit<InModule, "name">): Promise<LocalCourseFileListed[]> {
    const folder = await folderOf(module);
    const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => []);
    const names = entries.filter((e) => e.isFile() && isCourseFileName(e.name)).map((e) => e.name);
    return Promise.all(names.sort((x, y) => x.localeCompare(y)).map(async (name) => ({ name, ...(await fingerprintOf(path.join(folder, name))) })));
  },

  /** A file as the editor opens it. One that is gone (deleted, renamed) is not an error of the app's (see isNotFound). */
  async get(item: InModule): Promise<CourseFile> {
    const text = await readText(await pathOf(item));
    if (!text) throw new TRPCError({ code: "NOT_FOUND", message: `${item.name} is no longer in the files of ${item.moduleName}.` });
    return { name: item.name, ...text };
  },

  /** A new, empty file. Refused under the name of a file already there, so no file's text is ever written over. */
  async create(item: InModule) {
    const target = await pathOf(item);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, "", { flag: "wx" }).catch((e) => {
      throw e.code === "EEXIST" ? new Error(`There is already a ${item.name} in ${item.moduleName}.`) : e;
    });
  },

  /** Writes a file's text as the editor has it. Never over a file that isn't text (the editor had none of it), and never a file that is gone (renamed, deleted). */
  async save({ text, ...item }: InModule & { text: string }) {
    const target = await pathOf(item);
    const onDisk = await readText(target);
    if (!onDisk?.isText || onDisk.text === text) return;
    await fs.writeFile(target, text);
  },

  /** Renames a file or moves it to another module; its text is not touched, and it never takes another file's place. */
  async place({ courseName, from, to }: { courseName: string; from: Omit<InModule, "courseName">; to: Omit<InModule, "courseName"> }) {
    const [source, target] = [await pathOf({ courseName, ...from }), await pathOf({ courseName, ...to })];
    if (source === target) return;
    if (await directoryOrFileExists(target)) throw new Error(`There is already a ${to.name} in ${to.moduleName}: nothing was moved.`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.rename(source, target);
  },

  async remove(item: InModule) {
    await fs.rm(await pathOf(item), { force: true });
  },

  /** Every file of the course by its place in it. */
  async paths(courseName: string) {
    const root = await getCoursePathByName(courseName);
    const perFolder = await Promise.all(
      (await filesFolders(courseName)).map(async (dir) =>
        (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isFile() && isCourseFileName(e.name)).map((e) => inCourse(root, path.join(dir, e.name))),
      ),
    );
    return perFolder.flat().sort((a, b) => a.localeCompare(b));
  },

  /** The course's files that the file at `relative` uses in its own text (see usedFiles); none for a file that isn't text. */
  async used(courseName: string, relative: string) {
    const text = await readText(await courseFileOnDisk(courseName, relative));
    return usedFiles(relative, text?.text ?? "", await courseFileStorage.paths(courseName));
  },
};
