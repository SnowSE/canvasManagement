import { describe, expect, it } from "vitest";
import { courseFileFor, isCourseFileLink, linkedFiles, localFileUrl, pageLinkingTo, rewriteFileHrefs, usedFiles } from "./courseFileLinks";

const link = (href: string) => `<a href="${href}">x</a>`;

describe("the course's files a page links to: the links whose path goes through a files folder", () => {
  it.each([
    ["a file of the item's own module", "../files/kkoans.html", ["files/kkoans.html"]],
    ["the same, written from the module's folder", "files/kkoans.html", ["files/kkoans.html"]],
    ["a file of another module, which the link names", "../../Week 2/files/kkoans.html", ["Week 2/files/kkoans.html"]],
    ["any kind of file", "../files/syllabus.pdf", ["files/syllabus.pdf"]],
    ["a name with spaces, as markdown encodes it", "../files/My%20Demo.htm", ["files/My Demo.htm"]],
    ["a link into the file", "../files/kkoans.html#level-2", ["files/kkoans.html"]],
    ["not a file on the web", "https://example.com/files/kkoans.html", []],
    ["not a path from the site's root", "/files/kkoans.html", []],
    ["not a bare name, or a path through any other folder", "kkoans.html", []],
    ["not another item", "../pages/Tour.md", []],
    ["not a Canvas page", "../pages/belt-tour", []],
    ["not the folder itself", "../files/", []],
  ])("%s", (_, href, links) => expect(linkedFiles(link(href))).toEqual(links));
  it("an image or a frame from a files folder is such a file too", () => {
    expect(linkedFiles(`<img src="../files/drawing.svg" alt="d"><iframe src="../files/demo.html"></iframe>`)).toEqual(["files/drawing.svg", "files/demo.html"]);
    expect(isCourseFileLink("../files/drawing.svg")).toBe(true);
  });
  it("an image from the images folder is not, written from the root or not", () => {
    expect(linkedFiles(`<img src="/images/drawing.svg"><img src="images/facultyFiles/photo.png">`)).toEqual([]);
    expect(isCourseFileLink("images/facultyFiles/photo.png")).toBe(false);
  });
  it("lists a file linked twice once", () => {
    expect(linkedFiles(link("../files/kkoans.html") + link("./files/kkoans.html#top"))).toEqual(["files/kkoans.html"]);
  });
});

describe("the file a link names, among the course's files", () => {
  const paths = ["Week 1/files/kkoans.html", "Week 1/files/style.css", "Week 2/files/style.css"];
  it.each([
    ["a link naming its module is that module's file", "Week 2/files/style.css", "Week 2/files/style.css"],
    ["a link naming no module is the one file of that name", "files/kkoans.html", "Week 1/files/kkoans.html"],
    ["a link naming no module, where two modules have the name, is neither: it has to say which", "files/style.css", undefined],
    ["a file the course doesn't have is none", "Week 3/files/kkoans.html", undefined],
  ])("%s", (_, written, path) => expect(courseFileFor(written, paths)).toBe(path));
});

describe("links to those files, pointed somewhere else", () => {
  const toHref = (file: string) => (file === "files/kkoans.html" ? "/files/7/download" : undefined);
  it.each([
    ["point at where the file is", "../files/kkoans.html", "/files/7/download"],
    ["keep the place in the file", "../files/kkoans.html#level-2", "/files/7/download#level-2"],
    ["stay as written for a file with nowhere to point", "../files/other.html", "../files/other.html"],
    ["stay as written for any other link", "https://example.com/files/kkoans.html", "https://example.com/files/kkoans.html"],
  ])("%s", (_, href, expected) => expect(rewriteFileHrefs(link(href), toHref)).toBe(link(expected)));
  it("point an image at where the file is", () => {
    expect(rewriteFileHrefs(`<img src="../files/kkoans.html" alt="x">`, toHref)).toBe(`<img src="/files/7/download" alt="x">`);
  });
});

describe("where a preview finds a course's file", () => {
  it("is its place in the course under the preview's own address, so its relative addresses work as they do on disk", () => {
    const url = localFileUrl("/course-file/abc123", "Survey ('26 Fall)", "Week 1/files/My Demo.html");
    expect(url).toBe("/course-file/abc123/Survey%20('26%20Fall)/Week%201/files/My%20Demo.html");
    const from = (address: string) => decodeURIComponent(new URL(address, "http://localhost" + url).pathname);
    expect(from("style.css")).toBe("/course-file/abc123/Survey ('26 Fall)/Week 1/files/style.css");
    expect(from("../../Week 2/files/style.css")).toBe("/course-file/abc123/Survey ('26 Fall)/Week 2/files/style.css");
  });
});

describe("the course's files a file's own text uses", () => {
  const here = "Week 1/files/demo.html";
  const paths = [here, ...["style.css", "app.js", "theme.css", "mod.js", "data.json", "my logo.svg"].map((n) => "Week 1/files/" + n), "Week 2/files/style.css", "Week 2/files/shared.js"];
  it.each([
    ["a stylesheet beside it: its own module's, not another's of the same name", `<link rel="stylesheet" href="style.css">`, ["Week 1/files/style.css"]],
    ["a script, written with ./", `<script src="./app.js"></script>`, ["Week 1/files/app.js"]],
    ["a stylesheet's import", `@import url(theme.css);`, ["Week 1/files/theme.css"]],
    ["a module's import", `import { a } from "./mod.js";`, ["Week 1/files/mod.js"]],
    ["what a script fetches", `fetch('data.json?v=2')`, ["Week 1/files/data.json"]],
    ["a name with a space, as an address encodes it", `<img src="my%20logo.svg">`, ["Week 1/files/my logo.svg"]],
    ["another module's file, by its real place", `<script src="../../Week 2/files/shared.js"></script>`, ["Week 2/files/shared.js"]],
    ["not a file on the web, though it is at the same place there", `<link href="https://example.com/Week%201/files/style.css">`, []],
    ["not a file in a folder of its own, which is no file of the course", `<link href="css/style.css">`, []],
    ["not a name that is no file of the course", `<script src="other.js"></script>`, []],
    ["not itself", `<a href="demo.html#top">top</a>`, []],
  ])("%s", (_, text, used) => expect(usedFiles(here, text, paths)).toEqual(used));
});

describe("a page made for a file", () => {
  it("is named as the file is, without its ending, and links to the file from the same module", () => {
    expect(pageLinkingTo("k-koans.html")).toEqual({ name: "k-koans", text: "[k-koans](../files/k-koans.html)\n" });
  });
  it("its link is one the app takes for that file, whatever is in the name", () => {
    const { name, text } = pageLinkingTo("My Demo (v2).html");
    expect(name).toBe("My Demo (v2)");
    const href = /\]\((.*)\)\n$/.exec(text)![1];
    expect(linkedFiles(`<a href="${href}">x</a>`)).toEqual(["files/My Demo (v2).html"]);
  });
  it("a file with no ending gives the page its whole name", () => {
    expect(pageLinkingTo("README").name).toBe("README");
  });
});
