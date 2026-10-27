import path from "path";
import { promises as fs } from "fs";
import { basePath, directoryOrFileExists } from "../utils/fileSystemUtils";
import { getCoursePathByName } from "../globalSettings/globalSettingsFileStorageService";
import { quizMarkdownUtils } from "./models/utils/quizMarkdownUtils";
import { bankFolderName } from "./questionBankPaths";

/** The bank file a quiz's Bank: path points at, kept inside the storage folder. */
export function resolveBankPath(quizFilePath: string, bankPath: string) {
  const resolved = path.resolve(path.dirname(quizFilePath), bankPath);
  const storage = path.resolve(basePath);
  if (!resolved.startsWith(storage + path.sep))
    throw new Error(
      `Question bank ${bankPath} is outside the course files; give a path relative to the quiz, like ../banks/networking.md`,
    );
  if (!resolved.endsWith(".md"))
    throw new Error(`Question bank ${bankPath} isn't a .md file`);
  return resolved;
}

/** The text of one bank file, or why it can't be read. */
export async function readBank(
  quizFilePath: string,
  bankPath: string,
): Promise<{ text: string } | { error: string }> {
  try {
    const filePath = resolveBankPath(quizFilePath, bankPath);
    if (!(await directoryOrFileExists(filePath)))
      return {
        error: `Question bank ${bankPath} not found (looked for ${path.relative(path.resolve(basePath), filePath)})`,
      };
    return { text: (await fs.readFile(filePath, "utf-8")).replace(/\r\n/g, "\n") };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Every bank a quiz file names, by its Bank: path; throws when one can't be read. */
export async function loadBanks(quizFilePath: string, quizMarkdown: string) {
  const banks: Record<string, string> = {};
  for (const bankPath of quizMarkdownUtils.bankPaths(quizMarkdown)) {
    const bank = await readBank(quizFilePath, bankPath);
    if ("error" in bank) throw new Error(bank.error);
    banks[bankPath] = bank.text;
  }
  return banks;
}

/** Every .md file in a module's banks folder, as `<module>/banks/<file>`. */
export async function listBankFiles(courseName: string) {
  const courseDirectory = await getCoursePathByName(courseName);
  const modules = (await fs.readdir(courseDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name);
  const perModule = await Promise.all(
    modules.map(async (moduleName) => {
      const folder = path.join(courseDirectory, moduleName, bankFolderName);
      if (!(await directoryOrFileExists(folder))) return [];
      const entries = await fs.readdir(folder, { recursive: true });
      return entries
        .filter((entry) => entry.endsWith(".md"))
        .map((entry) =>
          [moduleName, bankFolderName, ...entry.split(path.sep)].join("/"),
        );
    }),
  );
  return perModule.flat().sort((a, b) => a.localeCompare(b));
}
