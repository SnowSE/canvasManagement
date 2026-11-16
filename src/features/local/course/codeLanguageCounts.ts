import path from "path";
import { promises as fs } from "fs";
import { getCoursePathByName } from "../globalSettings/globalSettingsFileStorageService";
import { countFenceLanguages } from "@/services/codeFenceScan";

/**
 * How many code blocks in the course's markdown name each language. The
 * editor leans its language guess toward these: a course that is mostly C#
 * gets C# guessed for a file's first code block.
 */
export async function countCourseCodeLanguages(courseName: string) {
  const courseDirectory = await getCoursePathByName(courseName);
  const entries = await fs.readdir(courseDirectory, { recursive: true });
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    if (!entry.endsWith(".md") || entry.split(path.sep).some((part) => part.startsWith(".")))
      continue;
    const text = await fs.readFile(path.join(courseDirectory, entry), "utf-8");
    countFenceLanguages(text.replace(/\r\n/g, "\n"), counts);
  }
  return counts;
}
