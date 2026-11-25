import { describe, expect, it } from "vitest";
import { canvasFileOf, fileSyncStatus, sendingOf, unsendableLinks, withCanvasFiles } from "./fileSyncStatus";

const koans = "Week 1/files/koans.html";
const inCanvas = { id: 7, display_name: "koans.html", path: koans, size: 120, locked: false };
const here = { hash: "abc", size: 120 };

describe("a course's file against its copy in Canvas", () => {
  it("is found in Canvas by its place: the folder of the same name there, and its name", () => {
    expect(canvasFileOf(koans, [inCanvas])).toBe(inCanvas);
    expect(canvasFileOf("Week 2/files/koans.html", [inCanvas])).toBeUndefined();
    expect(canvasFileOf(koans, undefined)).toBeUndefined();
  });

  it("not in Canvas: nothing is compared", () => {
    expect(fileSyncStatus(here)).toMatchObject({ status: "localOnly", differences: [] });
  });
  it("as this browser sent it, and unlocked: in sync and published", () => {
    expect(fileSyncStatus({ ...here, canvasFile: inCanvas, sent: { id: 7, hash: "abc" } })).toMatchObject({
      status: "published",
      message: "",
      differences: [],
      unpublished: false,
    });
  });
  it("edited since this browser sent it: its contents differ, though it is as long as it was", () => {
    const { status, differences } = fileSyncStatus({ ...here, hash: "new", canvasFile: inCanvas, sent: { id: 7, hash: "abc" } });
    expect(status).toBe("incomplete");
    expect(differences.map((d) => d.key)).toEqual(["contents"]);
  });
  it("sent from somewhere else, or replaced in Canvas since (another Canvas file than this browser sent): its length is what there is to compare", () => {
    const of = (size: number, sent?: { id: number; hash: string }) => fileSyncStatus({ hash: "new", size, canvasFile: inCanvas, sent }).differences.map((d) => d.key);
    expect(of(120)).toEqual([]);
    expect(of(121)).toEqual(["contents"]);
    expect(of(120, { id: 5, hash: "abc" })).toEqual([]);
  });
  it("locked in Canvas: unpublished, which is not a difference", () => {
    expect(fileSyncStatus({ ...here, canvasFile: { ...inCanvas, locked: true } })).toMatchObject({ status: "incomplete", differences: [], unpublished: true });
  });
});

describe("an item's links to the course's files, when it is sent to Canvas", () => {
  const paths = [koans, "Week 1/files/style.css", "Week 2/files/style.css"];
  it("is sent only when each link names one file of the course that Canvas has", () => {
    expect(unsendableLinks(["files/koans.html"], paths, [inCanvas])).toBeUndefined();
    expect(unsendableLinks(["files/koans.html"], paths, [])).toMatch(/Week 1\/files\/koans\.html, not in Canvas yet/);
    expect(unsendableLinks(["Week 2/files/style.css"], paths, [inCanvas])).toMatch(/Week 2\/files\/style\.css, not in Canvas yet/);
    expect(unsendableLinks(["files/style.css"], paths, [inCanvas])).toMatch(/files\/style\.css, which is not one file of the course.*say which/);
    expect(unsendableLinks(["files/nope.html"], paths, [inCanvas])).toMatch(/not one file of the course/);
    expect(unsendableLinks(["files/nope.html", "files/gone.svg"], paths, [inCanvas])).toMatch(/^it links to files\/nope\.html, files\/gone\.svg, which are not one file/);
    expect(unsendableLinks(["files/nope.html"], paths, [inCanvas])).toMatch(/files\/nope\.html, which is not one file/);
  });
  it("finds each file's address in Canvas among the settings it is rendered with, which are not saved", () => {
    const settings = { canvasId: 42, assets: [{ sourceUrl: "/images/a.png", canvasUrl: "https://canvas/a" }] };
    expect(withCanvasFiles(settings, [inCanvas]).assets).toEqual([
      { sourceUrl: "/images/a.png", canvasUrl: "https://canvas/a" },
      { sourceUrl: koans, canvasUrl: "https://snow.instructure.com/courses/42/files/7/download" },
    ]);
    expect(withCanvasFiles(settings, undefined)).toBe(settings);
  });
});

describe("what sending a file to Canvas replaces there", () => {
  const elsewhere = { ...inCanvas, id: 5, path: "Week 2/files/koans.html", locked: true };
  it("a file Canvas has at its place replaces that copy, whose lock it keeps", () => {
    expect(sendingOf(koans, [inCanvas, elsewhere], { id: 5 })).toEqual({ inCanvas: { id: 7, locked: false } });
  });
  it("a file Canvas doesn't have at its place, which this browser sent as a Canvas file still there: it was moved here since, and replaces that copy", () => {
    expect(sendingOf(koans, [elsewhere], { id: 5 })).toEqual({ movedFrom: { id: 5, locked: true } });
  });
  it("a file new to Canvas replaces nothing: not in Canvas, and nothing remembered of it, or the copy remembered is gone", () => {
    expect(sendingOf(koans, [elsewhere], undefined)).toEqual({});
    expect(sendingOf(koans, [], { id: 5 })).toEqual({});
    expect(sendingOf(koans, undefined, { id: 5 })).toEqual({});
  });
});
