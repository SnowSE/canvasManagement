import fs from "fs/promises";
import path from "path";
import { isLocalImageSource } from "@/services/imageSources";

// Faculty images are mounted under this folder (see docker-compose.yml), and a
// local image src like /images/facultyFiles/1405/a.png is a path inside it.
export const publicFolder = process.env.FILE_STORAGE_LOCATION ?? "/app/public";

const decode = (src: string) => {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
};

const relativeSrc = (src: string) => decode(src.trim()).replace(/^\.?\/+/, "");

// "/images/a.png", "images/a.png" and "./images/a.png" all mean the same file
// under the public directory. Anything that resolves outside it is treated as
// missing rather than read.
export const localPathForImage = (src: string, root = publicFolder) => {
  const resolved = path.resolve(root, relativeSrc(src));
  const rootWithSlash = path.resolve(root) + path.sep;
  return resolved.startsWith(rootWithSlash) ? resolved : undefined;
};

export interface ImageDiagnosis {
  found: boolean;
  /** where the app looked, inside the container */
  lookedFor?: string;
  /** what is wrong, in a sentence a person can act on */
  problem?: string;
  /** srcs of files that exist and are probably what was meant */
  suggestions: string[];
}

const isFile = (p: string) =>
  fs
    .stat(p)
    .then((s) => s.isFile())
    .catch(() => false);

const listFolder = (dir: string) =>
  fs.readdir(dir, { withFileTypes: true }).catch(() => undefined);

// the src to write in markdown for a file: spaces and the like encoded, since
// a raw space ends a markdown link
const srcFor = (filePath: string, root: string) =>
  "/" +
  path
    .relative(root, filePath)
    .split(path.sep)
    .map((part) => encodeURIComponent(part))
    .join("/");

const folderSrc = (dir: string, root: string) =>
  dir === path.resolve(root) ? "/" : srcFor(dir, root) + "/";

// "Lab 04-Formulas.PNG" and "lab04_formulas.png" are the same name to a person
const looseName = (name: string) =>
  name.toLowerCase().replace(/[\s_.-]+/g, "");

const withoutExtension = (name: string) => name.replace(/\.[^.]+$/, "");

const editDistance = (a: string, b: string) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return row[b.length];
};

const looksLike = (candidate: string, wanted: string) => {
  const a = looseName(candidate);
  const b = looseName(wanted);
  if (a === b) return true;
  if (looseName(withoutExtension(candidate)) === looseName(withoutExtension(wanted)))
    return true;
  return editDistance(a, b) <= Math.max(2, Math.floor(b.length / 6));
};

const someNames = (names: string[]) =>
  names.length <= 8
    ? names.join(", ")
    : `${names.slice(0, 8).join(", ")} and ${names.length - 8} more`;

const facultyFilesHint =
  " The faculty files folder is empty inside the container, so the volume for " +
  "/app/public/images/facultyFiles in docker-compose.yml is probably missing or " +
  "points at the wrong folder. Fix it and run restart.ps1.";

/**
 * Explains why a local image src does not resolve to a file: a path written
 * without /images/facultyFiles/ in front, letter case that differs (the
 * container is case-sensitive even when Windows and macOS are not), a name
 * that is close to a file that is there, or a faculty files folder that was
 * never mounted.
 */
export const diagnoseImage = async (
  src: string,
  root = publicFolder,
): Promise<ImageDiagnosis> => {
  if (!isLocalImageSource(src)) return { found: true, suggestions: [] };
  const lookedFor = localPathForImage(src, root);
  if (!lookedFor)
    return {
      found: false,
      problem:
        "The path climbs out of the public folder (it has .. in it), so the app will not read it.",
      suggestions: [],
    };
  if (await isFile(lookedFor)) return { found: true, lookedFor, suggestions: [] };

  const relative = relativeSrc(src);
  if (!relative.startsWith("images/")) {
    for (const prefix of ["images/facultyFiles", "images"]) {
      const candidate = path.join(root, prefix, relative);
      if (await isFile(candidate))
        return {
          found: false,
          lookedFor,
          problem:
            "Image paths start at the public folder, so a file in your faculty files folder is written with /images/facultyFiles/ in front.",
          suggestions: [srcFor(candidate, root)],
        };
    }
  }

  const segments = path.relative(path.resolve(root), lookedFor).split(path.sep);
  let dir = path.resolve(root);
  let caseDiffers = false;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;
    const entries = (await listFolder(dir)) ?? [];
    const exact = entries.find((e) => e.name === segment);
    const ignoringCase = entries.find(
      (e) => e.name.toLowerCase() === segment.toLowerCase(),
    );
    const match = exact ?? ignoringCase;
    if (match && (isLast ? match.isFile() : match.isDirectory())) {
      if (!exact) caseDiffers = true;
      dir = path.join(dir, match.name);
      continue;
    }

    const where = folderSrc(dir, root);
    const inFacultyFiles = path.relative(root, dir) === path.join("images", "facultyFiles");
    const mountMissing =
      (inFacultyFiles && entries.length === 0) ||
      (path.relative(root, dir) === "images" && segment === "facultyFiles");
    if (mountMissing)
      return { found: false, lookedFor, problem: `Nothing is in ${where}.${facultyFilesHint}`, suggestions: [] };

    const kind = isLast ? "file" : "folder";
    const sameKind = entries.filter((e) => (isLast ? e.isFile() : e.isDirectory()));
    const close = sameKind.filter((e) => looksLike(e.name, segment));
    const rest = segments.slice(i + 1);
    const suggestions = (
      await Promise.all(
        close.map(async (e) => {
          const candidate = path.join(dir, e.name, ...rest);
          return (await isFile(candidate)) ? srcFor(candidate, root) : undefined;
        }),
      )
    ).filter((s): s is string => !!s);
    const names = sameKind.map((e) => e.name);
    const problem =
      `There is no ${kind} named "${segment}" in ${where}.` +
      (suggestions.length > 0
        ? ""
        : names.length > 0
          ? ` The ${kind}s there are: ${someNames(names)}.`
          : ` That folder has no ${kind}s in it.`);
    return { found: false, lookedFor, problem, suggestions };
  }

  if (caseDiffers && (await isFile(dir)))
    return {
      found: false,
      lookedFor,
      problem:
        "The letter case is different. File and folder names are case-sensitive in the container, even when they are not on Windows or macOS.",
      suggestions: [srcFor(dir, root)],
    };
  return { found: false, lookedFor, problem: "The file could not be read.", suggestions: [] };
};

/** One line per missing image, for an error message. */
export const describeMissingImage = (src: string, diagnosis: ImageDiagnosis) =>
  `${src}: ${diagnosis.problem ?? "not found."}` +
  (diagnosis.suggestions.length > 0
    ? ` Did you mean ${diagnosis.suggestions.join(" or ")}?`
    : "") +
  (diagnosis.lookedFor ? ` (looked for ${diagnosis.lookedFor})` : "");
