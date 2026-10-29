import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import path from "path";

const { storage } = vi.hoisted(() => ({
  storage: `${process.env.TMPDIR ?? "/tmp"}/assignment-group-files-${process.pid}`,
}));
vi.mock("../utils/fileSystemUtils", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  basePath: storage,
}));
vi.mock("../globalSettings/globalSettingsFileStorageService", () => ({
  getCoursePathByName: async () => path.join(storage, "course"),
  getGlobalSettings: async () => ({ courses: [] }),
}));

const { countItemsByAssignmentGroup, moveItemsToAssignmentGroup } = await import("./assignmentGroupFiles");
const file = (p: string) => path.join(storage, "course", p);

describe("moving a group's items in the files", () => {
  beforeAll(async () => {
    for (const [p, text] of [
      ["1 - Intro/assignments/Lab 1.md", "Name: Lab 1\nAssignmentGroupName: Labs\n---\nLabs\n"],
      ["2 - Trees/quizzes/Quiz 1.md", "AssignmentGroup: Labs\nDescription:\n---\n"],
      ["2 - Trees/quizzes/Exam.md", "AssignmentGroup: Exams\nDescription:\n---\n"],
      ["2 - Trees/pages/Notes.md", "AssignmentGroup: Labs\n---\n"],
    ]) {
      await fs.mkdir(path.dirname(file(p)), { recursive: true });
      await fs.writeFile(file(p), text);
    }
  });
  afterAll(() => fs.rm(storage, { recursive: true, force: true }));

  it("counts the assignments and quizzes in each group, not pages", async () => {
    expect(await countItemsByAssignmentGroup("course")).toEqual({ Labs: 2, Exams: 1 });
  });

  it("moves every assignment and quiz in the group, in every module", async () => {
    expect(await moveItemsToAssignmentGroup("course", "Labs", "Exams")).toBe(2);
    expect(await countItemsByAssignmentGroup("course")).toEqual({ Exams: 3 });
    expect(await fs.readFile(file("1 - Intro/assignments/Lab 1.md"), "utf-8")).toBe(
      "Name: Lab 1\nAssignmentGroupName: Exams\n---\nLabs\n",
    );
  });
});
