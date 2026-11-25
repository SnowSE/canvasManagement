import { isCourseFileName } from "@/features/local/files/localCourseFileModels";

/**
 * Links from an item's markdown to one of the course's files (an HTML demo,
 * an SVG drawing, a PDF): `[K koans](../files/kkoans.html)`,
 * `![tree](../files/tree.svg)`, or the `src` of a frame. A link is to such a
 * file when its path goes through a `files` folder, which is where they are
 * kept (so nothing here knows any kind of file). A course file is known by
 * its place in the course, `<module>/files/<name>`: on disk, in the preview
 * and in the course's Canvas files alike, so an address that finds a file
 * on disk finds it everywhere. An item's link points at the copy in Canvas,
 * which the file's own Add to Canvas puts there (see canvasCourseFileSync).
 */

/** A course file's place in the course. */
export const courseFilePath = (moduleName: string, name: string) => `${moduleName}/files/${name}`;


/**
 * A relative href to a course file, apart: the file as the link names it
 * (`<module>/files/<name>`, or `files/<name>` when the link says no module,
 * as `../files/<name>` from an item of the same module doesn't), and the
 * place in it (`#…`, `?…`) kept as written.
 */
const parse = (href: string) => {
  const [, path, suffix] = /^([^#?]*)(.*)$/.exec(href)!;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("/")) return undefined;
  try {
    const [name = "", folder, moduleName = ""] = decodeURIComponent(path).split("/").reverse();
    if (folder !== "files" || !isCourseFileName(name)) return undefined;
    return { link: [".", "..", ""].includes(moduleName) ? `files/${name}` : courseFilePath(moduleName, name), suffix };
  } catch {
    return undefined;
  }
};

/** Whether a link or an image source as written is to a course file. */
export const isCourseFileLink = (href: string) => parse(href) !== undefined;

const hrefs = /\b(href|src)="([^"]+)"/g;

/** The course files `html` links to, as its links name them (see courseFileFor), each once. */
export const linkedFiles = (html: string) => [
  ...new Set([...html.matchAll(hrefs)].flatMap(([, , href]) => parse(href)?.link ?? [])),
];

/**
 * The course file a link names, among the course's files (`paths`). A link
 * that says no module (`files/<name>`) is the one file of that name; where
 * two modules each have one, it is neither, and the link has to say which
 * (`../../<module>/files/<name>`).
 */
export const courseFileFor = (link: string, paths: string[]) => {
  const named = link.startsWith("files/") ? paths.filter((p) => p.endsWith("/" + link)) : paths.filter((p) => p === link);
  return named.length === 1 ? named[0] : undefined;
};

/** `html` with each link to a course file pointed at `toHref(link)`; where that is undefined, as written. */
export const rewriteFileHrefs = (html: string, toHref: (link: string) => string | undefined) =>
  html.replace(hrefs, (written, attribute: string, href: string) => {
    const file = parse(href);
    const target = file && toHref(file.link);
    return target ? `${attribute}="${target}${file.suffix}"` : written;
  });

const encoded = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/**
 * Where the app itself serves a course's file (see the course-file route):
 * what a preview shows and a preview's links open. `base` is the preview's
 * own address, which only the app's pages are told (see previewBase); the
 * file's place in the course ends it, so the file's own relative addresses
 * (a stylesheet beside it, another module's script) reach the course's
 * other files as they do on disk.
 */
export const localFileUrl = (base: string, courseName: string, path: string) => `${base}/${encodeURIComponent(courseName)}/${encoded(path)}`;

// anything quoted or in brackets that could be an address: "style.css", './app.js', url(../../Intro/files/theme.css)
const addresses = /["'(]\s*([^"'()<>\n]+?)\s*["')]/g;

/**
 * The course's files that the file at `path` uses by a relative address in
 * its own text (a stylesheet, a script, an image, an import), found as a
 * browser would find them from where the file is.
 */
export const usedFiles = (path: string, text: string, paths: string[]) => {
  const from = "http://course/" + encoded(path);
  const used = new Set(
    [...text.matchAll(addresses)].flatMap(([, address]) => {
      try {
        const to = new URL(address, from);
        return to.host === "course" ? [decodeURIComponent(to.pathname.slice(1))] : [];
      } catch {
        return [];
      }
    }),
  );
  return paths.filter((known) => known !== path && used.has(known));
};

/**
 * The page that puts a file in front of students: named as the file is
 * without its ending, in the file's own module, with a link to the file.
 */
export const pageLinkingTo = (fileName: string) => {
  const name = fileName.replace(/(.)\.[^.]*$/, "$1");
  const href = encodeURIComponent(fileName).replace(/[()]/g, (c) => (c === "(" ? "%28" : "%29"));
  return { name, text: `[${name}](../files/${href})\n` };
};
