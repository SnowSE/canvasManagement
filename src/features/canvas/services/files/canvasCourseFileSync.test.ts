import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { renameCourseFile, uploadCourseFile } from "./canvasCourseFileSync";
import { fileStorageService } from "@/features/local/utils/fileStorageService";
import { uploadToCanvasPart1, uploadToCanvasPart2 } from "./canvasFileService";
import { canvasCourseFileService } from "./canvasCourseFileService";

const course = vi.hoisted(() => ({ dir: "" }));
vi.mock("@/features/local/globalSettings/globalSettingsFileStorageService", () => ({ getCoursePathByName: async () => course.dir }));
vi.mock("@/features/local/utils/fileStorageService", () => ({
  fileStorageService: { settings: { getCourseSettingsByName: vi.fn() } },
}));
vi.mock("./canvasFileService", () => ({
  uploadToCanvasPart1: vi.fn(async () => ({ upload_url: "up", upload_params: {} })),
  uploadToCanvasPart2: vi.fn(async () => ({ id: 7, url: "https://canvas/files/7/download?download_frd=1" })),
}));
vi.mock("./canvasCourseFileService", () => ({ canvasCourseFileService: { setLocked: vi.fn(), delete: vi.fn(), rename: vi.fn() } }));
const write = async (file: string, text: string) => {
  await fs.mkdir(path.dirname(path.join(course.dir, file)), { recursive: true });
  await fs.writeFile(path.join(course.dir, file), text);
};
const koans = "Week 1/files/kkoans.html";
const upload = (file: string, found: { inCanvas?: { id: number; locked: boolean }; movedFrom?: { id: number; locked: boolean } } = {}) => uploadCourseFile({ courseName: "Course", path: file, ...found });
const { setLocked } = canvasCourseFileService;

describe("a file of the course, sent to the course's Canvas files", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    course.dir = await fs.mkdtemp(path.join(os.tmpdir(), "course-"));
    vi.mocked(fileStorageService.settings.getCourseSettingsByName).mockResolvedValue({ canvasId: 42, assets: [] } as never);
    await write(koans, "<p>koans</p>");
  });

  it("goes into the Canvas folder of its own place in the course, so the files it uses beside it are beside it there, and it is found again by that place", async () => {
    expect(await upload(koans)).toBe(7);
    expect(vi.mocked(uploadToCanvasPart1).mock.calls[0]).toEqual([path.join(course.dir, koans), 42, "Week 1/files"]);
  });
  it("is the file at that place: two modules may each have one of a name", async () => {
    await write("Week 2/files/kkoans.html", "<p>other koans</p>");
    await upload("Week 2/files/kkoans.html");
    expect(vi.mocked(uploadToCanvasPart2).mock.calls[0][0].pathToUpload).toBe(path.join(course.dir, "Week 2/files/kkoans.html"));
  });
  // Canvas shows an upload to every student at once, in the course's Files and by its address
  it("is locked when it is new to Canvas, as any new item starts unpublished", async () => {
    await upload(koans);
    expect(setLocked).toHaveBeenCalledWith(7, true);
  });
  it.each([true, false])("sent again over the copy at its place, is left as that copy was (locked: %s)", async (locked) => {
    await upload(koans, { inCanvas: { id: 7, locked } });
    expect(setLocked).toHaveBeenCalledWith(7, locked);
    expect(canvasCourseFileService.delete).not.toHaveBeenCalled();
  });
  it("moved here since it was sent: it takes the lock of the copy at its old place, and that copy is deleted, so none is left behind", async () => {
    await upload(koans, { movedFrom: { id: 5, locked: false } });
    expect(setLocked).toHaveBeenCalledWith(7, false);
    expect(canvasCourseFileService.delete).toHaveBeenCalledWith(5);
  });
  it.each([
    ["a file that isn't there", "Week 1/files/missing.html"],
    ["a file outside a module's files folder", "Week 1/pages/kkoans.html"],
    ["a hidden file", "Week 1/files/.hidden"],
    ["a path out of the course", "Week 1/files/../../../secret.html"],
  ])("refuses %s", async (_, file) => {
    await write("Week 1/pages/kkoans.html", "x");
    await write("Week 1/files/.hidden", "x");
    await expect(upload(file)).rejects.toThrow(/not/i);
    expect(uploadToCanvasPart2).not.toHaveBeenCalled();
  });

  describe("renamed in the app", () => {
    const rename = (canvasFileId?: number) => renameCourseFile({ courseName: "Course", moduleName: "Week 1", name: "kkoans.html", newName: "k.html", canvasFileId });
    it("is renamed on disk, and in Canvas where it is, staying the Canvas file it was", async () => {
      await rename(5);
      await expect(fs.readFile(path.join(course.dir, "Week 1/files/k.html"), "utf-8")).resolves.toBe("<p>koans</p>");
      expect(canvasCourseFileService.rename).toHaveBeenCalledWith(5, "k.html");
    });
    it("not in Canvas: only on disk", async () => {
      await rename();
      await expect(fs.readFile(path.join(course.dir, "Week 1/files/k.html"), "utf-8")).resolves.toBe("<p>koans</p>");
      expect(canvasCourseFileService.rename).not.toHaveBeenCalled();
    });
    it("is refused onto the name of another file", async () => {
      await write("Week 1/files/k.html", "other");
      await expect(rename(5)).rejects.toThrow(/k\.html/);
      expect(canvasCourseFileService.rename).not.toHaveBeenCalled();
    });
  });
});
