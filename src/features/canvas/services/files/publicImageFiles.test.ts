import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { describeMissingImage, diagnoseImage } from "./publicImageFiles";

let root: string;
const write = async (relative: string) => {
  const file = path.join(root, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, "png");
};

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "public-images-"));
  await write("images/facultyFiles/1405/Lab-04 Formulas.png");
  await write("images/facultyFiles/1405/lab-05-loops.png");
  await write("images/facultyFiles/3630/diagram.svg");
});

afterAll(() => fs.rm(root, { recursive: true, force: true }));

describe("diagnoseImage", () => {
  it("finds a file that is there, spaces written as %20 or not", async () => {
    expect((await diagnoseImage("/images/facultyFiles/1405/Lab-04%20Formulas.png", root)).found).toBe(true);
    expect((await diagnoseImage("/images/facultyFiles/1405/Lab-04 Formulas.png", root)).found).toBe(true);
  });

  it("leaves web images alone", async () => {
    expect(await diagnoseImage("https://example.edu/a.png", root)).toEqual({ found: true, suggestions: [] });
  });

  it("points out letter case that differs from the file on disk", async () => {
    const diagnosis = await diagnoseImage("/images/facultyfiles/1405/lab-04 formulas.PNG", root);
    expect(diagnosis.found).toBe(false);
    expect(diagnosis.problem).toMatch(/case/);
    expect(diagnosis.suggestions).toEqual(["/images/facultyFiles/1405/Lab-04%20Formulas.png"]);
  });

  it("suggests a close file name in the same folder", async () => {
    const diagnosis = await diagnoseImage("/images/facultyFiles/1405/lab-5-loops.png", root);
    expect(diagnosis.problem).toContain('no file named "lab-5-loops.png" in /images/facultyFiles/1405/');
    expect(diagnosis.suggestions).toEqual(["/images/facultyFiles/1405/lab-05-loops.png"]);
  });

  it("suggests the same name with another extension", async () => {
    const diagnosis = await diagnoseImage("/images/facultyFiles/3630/diagram.png", root);
    expect(diagnosis.suggestions).toEqual(["/images/facultyFiles/3630/diagram.svg"]);
  });

  it("lists what is in the folder when nothing is close", async () => {
    const diagnosis = await diagnoseImage("/images/facultyFiles/9999/a.png", root);
    expect(diagnosis.problem).toBe(
      'There is no folder named "9999" in /images/facultyFiles/. The folders there are: 1405, 3630.',
    );
    expect(diagnosis.suggestions).toEqual([]);
  });

  it("fixes a path written without /images/facultyFiles/ in front", async () => {
    const diagnosis = await diagnoseImage("1405/lab-05-loops.png", root);
    expect(diagnosis.problem).toMatch(/start at the public folder/);
    expect(diagnosis.suggestions).toEqual(["/images/facultyFiles/1405/lab-05-loops.png"]);
  });

  it("blames the volume when the faculty files folder is empty", async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), "public-empty-"));
    await fs.mkdir(path.join(empty, "images/facultyFiles"), { recursive: true });
    const diagnosis = await diagnoseImage("/images/facultyFiles/1405/a.png", empty);
    expect(diagnosis.problem).toMatch(/docker-compose\.yml/);
    await fs.rm(empty, { recursive: true, force: true });
  });

  it("refuses a path that climbs out of the public folder", async () => {
    const diagnosis = await diagnoseImage("/../../etc/passwd", root);
    expect(diagnosis.found).toBe(false);
    expect(diagnosis.lookedFor).toBeUndefined();
  });

  it("does not throw on a malformed % escape", async () => {
    expect((await diagnoseImage("/images/facultyFiles/100%.png", root)).found).toBe(false);
  });

  it("reads as one line in an error message", async () => {
    const src = "/images/facultyFiles/1405/lab-5-loops.png";
    expect(describeMissingImage(src, await diagnoseImage(src, root))).toBe(
      `${src}: There is no file named "lab-5-loops.png" in /images/facultyFiles/1405/. ` +
        "Did you mean /images/facultyFiles/1405/lab-05-loops.png? " +
        `(looked for ${path.join(root, "images/facultyFiles/1405/lab-5-loops.png")})`,
    );
  });
});
