import fs from "fs/promises";
import path from "path";
import { getCoursePathByName } from "../globalSettings/globalSettingsFileStorageService";
import { getModuleNamesFromFiles } from "../modules/moduleRouter";
import { directoryOrFileExists } from "../utils/fileSystemUtils";
import { typeToFolder } from "./courseItemTypes";

// quizzes say AssignmentGroup:, assignments AssignmentGroupName:
const groupLine = /^(AssignmentGroup(?:Name)?:[ \t]*)(.*?)[ \t]*$/m;

const settingsAndBody = (text: string) => {
  const end = text.indexOf("\n---\n");
  return end === -1 ? [text, ""] : [text.slice(0, end), text.slice(end)];
};

/** The assignment group an assignment or quiz file names, if any. */
export const assignmentGroupOf = (text: string) =>
  groupLine.exec(settingsAndBody(text)[0])?.[2];

/** The file with its assignment group changed from `from` to `to`. */
export function withAssignmentGroup(text: string, from: string, to: string) {
  const [settings, body] = settingsAndBody(text);
  const match = groupLine.exec(settings);
  if (match?.[2] !== from) return text;
  return settings.replace(groupLine, `$1${to}`) + body;
}

/** Every assignment and quiz file in the course. */
async function itemFiles(courseName: string) {
  const courseDirectory = await getCoursePathByName(courseName);
  const folders = (await getModuleNamesFromFiles(courseName)).flatMap((module) =>
    [typeToFolder.Assignment, typeToFolder.Quiz].map((folder) =>
      path.join(courseDirectory, module, folder),
    ),
  );
  const perFolder = await Promise.all(
    folders.map(async (folder) =>
      (await directoryOrFileExists(folder))
        ? (await fs.readdir(folder))
            .filter((f) => f.endsWith(".md"))
            .map((f) => path.join(folder, f))
        : [],
    ),
  );
  return perFolder.flat();
}

/** How many assignment and quiz files name each group. */
export async function countItemsByAssignmentGroup(courseName: string) {
  const counts: Record<string, number> = {};
  for (const file of await itemFiles(courseName)) {
    const group = assignmentGroupOf(await fs.readFile(file, "utf-8"));
    if (group !== undefined) counts[group] = (counts[group] ?? 0) + 1;
  }
  return counts;
}

/** Moves every assignment and quiz in group `from` to `to`; returns how many moved. */
export async function moveItemsToAssignmentGroup(courseName: string, from: string, to: string) {
  let moved = 0;
  for (const file of await itemFiles(courseName)) {
    const text = await fs.readFile(file, "utf-8");
    const changed = withAssignmentGroup(text, from, to);
    if (changed === text) continue;
    await fs.writeFile(file, changed);
    moved++;
  }
  return moved;
}
