import path from "path";
import { directoryOrFileExists } from "../utils/fileSystemUtils";
import fs from "fs/promises";
import { localAssignmentMarkdown } from "@/features/local/assignments/models/localAssignment";
import {
  CourseItemReturnType,
  CourseItemType,
  typeToFolder,
} from "@/features/local/course/courseItemTypes";
import {
  getCoursePathByName,
  getGlobalSettings,
} from "../globalSettings/globalSettingsFileStorageService";
import { localPageMarkdownUtils } from "@/features/local/pages/localCoursePageModels";
import { quizMarkdownUtils } from "../quizzes/models/utils/quizMarkdownUtils";
import { getFeedbackDelimitersFromSettings } from "../globalSettings/globalSettingsUtils";
import { extractLabelValue } from "../assignments/models/utils/markdownUtils";
import { getDateFromString } from "../utils/timeUtils";
import {
  errorMessageOf,
  fileErrorKey,
  logError,
  resolveError,
} from "../errorLog/errorLogStore";

const getItemFileNames = async ({
  courseName,
  moduleName,
  type,
}: {
  courseName: string;
  moduleName: string;
  type: CourseItemType;
}) => {
  const courseDirectory = await getCoursePathByName(courseName);
  const folder = typeToFolder[type];
  const filePath = path.join(courseDirectory, moduleName, folder);
  if (!(await directoryOrFileExists(filePath))) {
    console.log(
      `Error loading ${type}, ${folder} folder does not exist in ${filePath}`,
    );
    await fs.mkdir(filePath);
  }

  const itemFiles = await fs.readdir(filePath);
  return itemFiles.map((f) => f.replace(/\.md$/, ""));
};

const getItem = async <T extends CourseItemType>({
  courseName,
  moduleName,
  name,
  type,
}: {
  courseName: string;
  moduleName: string;
  name: string;
  type: T;
}): Promise<CourseItemReturnType<T>> => {
  const courseDirectory = await getCoursePathByName(courseName);
  const folder = typeToFolder[type];
  const filePath = path.join(courseDirectory, moduleName, folder, name + ".md");
  if (!(await directoryOrFileExists(filePath))) {
    const available = await getItemFileNames({ courseName, moduleName, type });
    const itemList = available.length > 0 ? available.join(", ") : "(none)";
    throw new Error(
      `${type} "${name}" not found in module "${moduleName}" of course "${courseName}". Available ${type.toLowerCase()}s: ${itemList}`,
    );
  }
  const rawFile = (await fs.readFile(filePath, "utf-8")).replace(/\r\n/g, "\n");
  try {
    const item = await parseItemText(type, rawFile, name);
    resolveError(fileErrorKey(filePath));
    return item;
  } catch (e) {
    logItemError({ courseName, moduleName, name, type }, filePath, e);
    throw e;
  }
};

const logItemError = (
  {
    courseName,
    moduleName,
    name,
    type,
  }: { courseName: string; moduleName: string; name: string; type: CourseItemType },
  filePath: string,
  e: unknown,
) =>
  logError({
    key: fileErrorKey(filePath),
    source: `Reading ${type.toLowerCase()} "${name}" in module "${moduleName}"`,
    message: errorMessageOf(e),
    context: { courseName, moduleName, itemType: type, itemName: name, filePath },
  });

/** Parses the text of an item file with the real parser; throws if it can't. */
export const parseItemText = async <T extends CourseItemType>(
  type: T,
  rawFile: string,
  name: string,
): Promise<CourseItemReturnType<T>> => {
  if (type === "Assignment") {
    return localAssignmentMarkdown.parseMarkdown(
      rawFile,
      name,
    ) as CourseItemReturnType<T>;
  } else if (type === "Quiz") {
    const globalSettings = await getGlobalSettings();
    const delimiters = getFeedbackDelimitersFromSettings(globalSettings);
    return quizMarkdownUtils.parseMarkdown(
      rawFile,
      name,
      delimiters,
    ) as CourseItemReturnType<T>;
  } else if (type === "Page") {
    return localPageMarkdownUtils.parseMarkdown(
      rawFile,
      name,
    ) as CourseItemReturnType<T>;
  }

  throw Error(`cannot read item, invalid type: ${type}`);
};

export const itemFilePath = async ({
  courseName,
  moduleName,
  name,
  type,
}: {
  courseName: string;
  moduleName: string;
  name: string;
  type: CourseItemType;
}) =>
  path.join(
    await getCoursePathByName(courseName),
    moduleName,
    typeToFolder[type],
    name + ".md",
  );

export interface InvalidCourseItem {
  type: CourseItemType;
  name: string;
  error: string;
  // the file's own date when that line still reads, so the calendar can
  // show the broken item on its day
  dueAt?: string;
}

/** DueAt (DueDateForOrdering for a page) read straight off the file, or undefined. */
export const looseDueDate = (type: CourseItemType, rawFile: string) => {
  const settings = rawFile.split("---\n")[0] + "\n";
  const value = extractLabelValue(
    settings,
    type === "Page" ? "DueDateForOrdering" : "DueAt",
  );
  return value && getDateFromString(value) ? value : undefined;
};

export const courseItemFileStorageService = {
  getItem,
  getItems: async <T extends CourseItemType>({
    courseName,
    moduleName,
    type,
  }: {
    courseName: string;
    moduleName: string;
    type: T;
  }): Promise<CourseItemReturnType<T>[]> => {
    const fileNames = await getItemFileNames({ courseName, moduleName, type });
    const items = (
      await Promise.all(
        fileNames.map(async (name) => {
          try {
            const item = await getItem({ courseName, moduleName, name, type });
            return item;
          } catch (e) {
            // getItem logged it to the error log; the module list shows it
            // through getInvalidItems so it can be opened and fixed
            console.log(
              `Error loading ${type} ${name} in module ${moduleName}:`,
              errorMessageOf(e),
            );
            return null;
          }
        }),
      )
    ).filter((a) => a !== null);
    return items;
  },

  /** Files in a module that exist but don't parse, so they can be fixed. */
  async getInvalidItems({
    courseName,
    moduleName,
  }: {
    courseName: string;
    moduleName: string;
  }): Promise<InvalidCourseItem[]> {
    const types: CourseItemType[] = ["Assignment", "Quiz", "Page"];
    const perType = await Promise.all(
      types.map(async (type) => {
        const names = await getItemFileNames({ courseName, moduleName, type });
        const results = await Promise.all(
          names.map(async (name) => {
            const filePath = await itemFilePath({ courseName, moduleName, name, type });
            const raw = (await fs.readFile(filePath, "utf-8")).replace(/\r\n/g, "\n");
            try {
              await parseItemText(type, raw, name);
              return null;
            } catch (e) {
              return {
                type,
                name,
                error: errorMessageOf(e),
                dueAt: looseDueDate(type, raw),
              };
            }
          }),
        );
        return results.filter((r) => r !== null);
      }),
    );
    return perType.flat();
  },

  /** The file as written, with the parse error if it doesn't parse. */
  async getRawItem(args: {
    courseName: string;
    moduleName: string;
    name: string;
    type: CourseItemType;
  }): Promise<{ text: string; error?: string }> {
    const filePath = await itemFilePath(args);
    const text = (await fs.readFile(filePath, "utf-8")).replace(/\r\n/g, "\n");
    try {
      await parseItemText(args.type, text, args.name);
      resolveError(fileErrorKey(filePath));
      return { text };
    } catch (e) {
      logItemError(args, filePath, e);
      return { text, error: errorMessageOf(e) };
    }
  },

  /**
   * Writes the text exactly as given, valid or not, so a broken file can be
   * fixed in several edits. Returns the parse error if it still doesn't parse.
   */
  async saveRawItem(args: {
    courseName: string;
    moduleName: string;
    name: string;
    type: CourseItemType;
    text: string;
  }): Promise<{ error?: string }> {
    const filePath = await itemFilePath(args);
    if (!(await directoryOrFileExists(filePath)))
      throw new Error(`${args.type} "${args.name}" no longer exists`);
    await fs.writeFile(filePath, args.text);
    try {
      await parseItemText(args.type, args.text, args.name);
      resolveError(fileErrorKey(filePath));
      return {};
    } catch (e) {
      logItemError(args, filePath, e);
      return { error: errorMessageOf(e) };
    }
  },
};
