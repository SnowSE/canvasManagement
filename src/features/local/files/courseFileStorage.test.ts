import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import path from "path";

const { storage } = vi.hoisted(() => ({
  storage: `${process.env.TMPDIR ?? "/tmp"}/course-files-${process.pid}`,
}));
vi.mock("../utils/fileSystemUtils", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  basePath: storage,
}));
vi.mock("../globalSettings/globalSettingsFileStorageService", () => ({
  // as the app has it: relative to where the server runs
  getCoursePathByName: async () => path.relative(process.cwd(), path.join(storage, "course")),
  getGlobalSettings: async () => ({ courses: [] }),
}));

const { courseFileStorage: files } = await import("./courseFileStorage");
const { courseItemFileStorageService: items } = await import("../course/courseItemFileStorageService");

const at = (p: string) => path.join(storage, "course", p);
const write = async (p: string, text: string) => {
  await fs.mkdir(path.dirname(at(p)), { recursive: true });
  await fs.writeFile(at(p), text);
};
const read = (p: string) => fs.readFile(at(p), "utf-8");

// a script the markdown renderer would break: blank lines, indentation, a --- line
const koans = "<!doctype html>\n<script>\n\n    const a = 1;\n---\n</script>\n";
const inModule = { courseName: "course", moduleName: "7 - Arrays" };
const koansFile = { ...inModule, name: "koans.html" };

describe("a module's files", () => {
  beforeEach(async () => {
    await fs.rm(storage, { recursive: true, force: true });
    await write("7 - Arrays/files/koans.html", koans);
    await write("7 - Arrays/files/style.css", "p { color: red }");
  });
  afterAll(() => fs.rm(storage, { recursive: true, force: true }));

  it("every file of the module's files folder is the module's, listed without its text, with its length and a hash", async () => {
    const listed = await files.inModule(inModule);
    expect(listed.map((f) => Object.keys(f))).toEqual([["name", "hash", "size"], ["name", "hash", "size"]]);
    expect(listed.map((f) => [f.name, f.size])).toEqual([["koans.html", Buffer.byteLength(koans)], ["style.css", 16]]);
  });

  it("the hash follows the file's text, not its date", async () => {
    const [before] = await files.inModule(inModule);
    const later = new Date(Date.now() + 60_000);
    await fs.utimes(at("7 - Arrays/files/koans.html"), later, later);
    expect((await files.inModule(inModule))[0].hash).toBe(before.hash);
    await write("7 - Arrays/files/koans.html", koans + " ");
    expect((await files.inModule(inModule))[0].hash).not.toBe(before.hash);
  });

  it("only what is in a module's files folder is a file of the course: not a hidden file, a folder, or a file kept anywhere else", async () => {
    await write("7 - Arrays/files/.DS_Store", "");
    await write("7 - Arrays/files/drafts/old.html", "<p>old</p>");
    await write("7 - Arrays/pages/demo.html", "<p>demo</p>");
    await write("7 - Arrays/starters/app/index.html", "");
    await write("loose.html", "");
    expect(await files.paths("course")).toEqual(["7 - Arrays/files/koans.html", "7 - Arrays/files/style.css"]);
    await expect(files.get({ ...inModule, name: ".DS_Store" })).rejects.toThrow();
    await expect(files.get({ ...inModule, name: "../pages/demo.html" })).rejects.toThrow();
  });

  it("is no item to be parsed: a markdown file among a module's files is not a page that can't be read", async () => {
    await write("7 - Arrays/files/notes.md", "no settings here");
    expect(await items.getInvalidItems(inModule)).toEqual([]);
  });

  it("a file opens with its text, and whether it is text", async () => {
    expect(await files.get(koansFile)).toEqual({ name: "koans.html", text: koans, isText: true });
    await expect(files.get({ ...inModule, name: "gone.html" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  describe("a file that isn't text (an image, a PDF)", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 0xff, 0xfe]);
    const photo = { ...inModule, name: "photo.png" };
    beforeEach(() => fs.writeFile(at("7 - Arrays/files/photo.png"), png));
    it("is a file like any other, with no text for the editor", async () => {
      expect(await files.get(photo)).toEqual({ name: "photo.png", text: "", isText: false });
    });
    it("is never written over by the editor", async () => {
      await files.save({ ...photo, text: "typed" });
      expect(await fs.readFile(at("7 - Arrays/files/photo.png"))).toEqual(png);
    });
  });

  it("a file's own text says which of the course's files it uses, as a browser would find them from where it is", async () => {
    await write("8 - Forth/files/style.css", "");
    await write("8 - Forth/files/shared.js", "");
    await write("7 - Arrays/files/koans.html", `<link href="style.css"><script src="../../8 - Forth/files/shared.js"></script>`);
    expect(await files.used("course", "7 - Arrays/files/koans.html")).toEqual(["7 - Arrays/files/style.css", "8 - Forth/files/shared.js"]);
  });

  describe("a new file", () => {
    const create = (name: string) => files.create({ ...inModule, name });
    it("is empty", async () => {
      await create("new.html");
      expect(await files.get({ ...inModule, name: "new.html" })).toEqual({ name: "new.html", text: "", isText: true });
    });
    it("is refused under the name of a file already there, whose text is never written over", async () => {
      await expect(create("style.css")).rejects.toThrow(/already/);
      expect(await read("7 - Arrays/files/style.css")).toBe("p { color: red }");
    });
    it("may have the name of another module's file: each is its own, known by its place", async () => {
      await write("8 - Forth/files/demo.html", "<p>demo</p>");
      await create("demo.html");
      expect(await files.paths("course")).toContain("7 - Arrays/files/demo.html");
    });
    it("can't be a hidden file, or a path", async () => {
      await expect(create(".hidden")).rejects.toThrow();
      await expect(create("a/b.html")).rejects.toThrow();
    });
  });

  it("saving writes the file's text exactly as typed", async () => {
    const edited = koans + "\n\n  <p>more</p>";
    await files.save({ ...koansFile, text: edited });
    expect(await read("7 - Arrays/files/koans.html")).toBe(edited);
  });

  it("is not brought back by a save that arrives after it was renamed or deleted", async () => {
    await files.save({ ...inModule, name: "gone.html", text: "late" });
    await expect(read("7 - Arrays/files/gone.html")).rejects.toThrow();
  });
  it("is renamed, or moved to another module, its text as it was", async () => {
    await files.place({ courseName: "course", from: { moduleName: "7 - Arrays", name: "koans.html" }, to: { moduleName: "8 - Forth", name: "k.html" } });
    expect((await files.inModule(inModule)).map((f) => f.name)).toEqual(["style.css"]);
    expect(await files.get({ courseName: "course", moduleName: "8 - Forth", name: "k.html" })).toEqual({ name: "k.html", text: koans, isText: true });
  });

  it("a rename never overwrites another file", async () => {
    await expect(files.place({ courseName: "course", from: { moduleName: "7 - Arrays", name: "koans.html" }, to: { moduleName: "7 - Arrays", name: "style.css" } })).rejects.toThrow(/style\.css/);
    expect(await read("7 - Arrays/files/style.css")).toBe("p { color: red }");
    expect(await read("7 - Arrays/files/koans.html")).toBe(koans);
  });

  it("is deleted", async () => {
    await files.remove(koansFile);
    expect(await fs.readdir(at("7 - Arrays/files"))).toEqual(["style.css"]);
  });
});
