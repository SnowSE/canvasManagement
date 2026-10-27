import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import { bankPathFromQuiz } from "./questionBankPaths";

const { storage } = vi.hoisted(() => ({
  storage: `${process.env.TMPDIR ?? "/tmp"}/banks-test-${process.pid}`,
}));

vi.mock("../utils/fileSystemUtils", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  basePath: storage,
}));
vi.mock("../globalSettings/globalSettingsFileStorageService", () => ({
  getCoursePathByName: async () => path.join(storage, "course"),
  getGlobalSettings: async () => ({ courses: [] }),
}));

const { listBankFiles, loadBanks, readBank, resolveBankPath } = await import(
  "./questionBankFileStorage"
);

const quizFile = path.join(storage, "course", "1 - Networking", "quizzes", "Ports.md");

describe("question bank files", () => {
  beforeAll(async () => {
    for (const [file, text] of [
      ["1 - Networking/banks/ports.md", "One?\n*a) yes"],
      ["1 - Networking/banks/more/layers.md", "Two?\n*a) yes"],
      ["2 - Security/banks/ciphers.md", "Three?\n*a) yes"],
      ["2 - Security/banks/notes.txt", "not a bank"],
      ["1 - Networking/quizzes/Ports.md", ""],
    ]) {
      const full = path.join(storage, "course", file);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, text);
    }
  });
  afterAll(async () => {
    await fs.rm(storage, { recursive: true, force: true });
  });

  it("reads a bank by its path relative to the quiz", async () => {
    expect(await readBank(quizFile, "../banks/ports.md")).toEqual({ text: "One?\n*a) yes" });
    expect(await readBank(quizFile, "../../2 - Security/banks/ciphers.md")).toEqual({
      text: "Three?\n*a) yes",
    });
  });

  it("says where it looked for a bank that isn't there", async () => {
    expect(await readBank(quizFile, "../banks/missing.md")).toEqual({
      error: "Question bank ../banks/missing.md not found (looked for course/1 - Networking/banks/missing.md)",
    });
  });

  it("won't read outside the course files or a file that isn't markdown", () => {
    expect(() => resolveBankPath(quizFile, "../../../../../etc/passwd.md")).toThrow(
      "outside the course files",
    );
    expect(() => resolveBankPath(quizFile, "../banks/notes.txt")).toThrow("isn't a .md file");
  });

  it("loads every bank a quiz names, and fails on one it can't read", async () => {
    expect(await loadBanks(quizFile, "Group: A\nPick: 1\nBank: ../banks/ports.md")).toEqual({
      "../banks/ports.md": "One?\n*a) yes",
    });
    await expect(loadBanks(quizFile, "Bank: ../banks/missing.md")).rejects.toThrow("not found");
  });

  it("lists the bank files in every module's banks folder", async () => {
    expect(await listBankFiles("Course")).toEqual([
      "1 - Networking/banks/more/layers.md",
      "1 - Networking/banks/ports.md",
      "2 - Security/banks/ciphers.md",
    ]);
  });

  it("writes a bank's path relative to a quiz in its module or another", () => {
    expect(bankPathFromQuiz("1 - Networking", "1 - Networking/banks/ports.md")).toBe(
      "../banks/ports.md",
    );
    expect(bankPathFromQuiz("1 - Networking", "2 - Security/banks/ciphers.md")).toBe(
      "../../2 - Security/banks/ciphers.md",
    );
  });
});
