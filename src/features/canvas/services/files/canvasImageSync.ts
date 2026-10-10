import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { fileStorageService } from "@/features/local/utils/fileStorageService";
import { isLocalImageSource } from "@/services/imageSources";
import { uploadToCanvasPart1, uploadToCanvasPart2 } from "./canvasFileService";

const fileStorageLocation = process.env.FILE_STORAGE_LOCATION ?? "/app/public";

// "/images/a.png", "images/a.png" and "./images/a.png" all mean the same file
// under the public directory. Anything that resolves outside it is treated as
// missing rather than read.
export const localPathForImage = (src: string, root = fileStorageLocation) => {
  const relative = decodeURI(src.trim()).replace(/^\.?\/+/, "");
  const resolved = path.resolve(root, relative);
  const rootWithSlash = path.resolve(root) + path.sep;
  return resolved.startsWith(rootWithSlash) ? resolved : undefined;
};

const readImage = async (src: string) => {
  const localPath = localPathForImage(src);
  if (!localPath) return undefined;
  try {
    const contents = await fs.readFile(localPath);
    const hash = crypto
      .createHash("sha256")
      .update(contents)
      .digest("hex")
      .slice(0, 16);
    return { localPath, hash };
  } catch {
    return undefined;
  }
};

/**
 * Makes sure every local image is in the course's Canvas files, uploading new
 * ones and ones whose contents changed since they were uploaded, and records
 * them in settings.assets. Returns the settings to render with. Throws, after
 * saving whatever did upload, if an image file can't be found, so a publish
 * never sends Canvas a link that only works on this computer.
 */
export const ensureImagesUploaded = async (
  courseName: string,
  sources: string[],
): Promise<LocalCourseSettings> => {
  const settings = await fileStorageService.settings.getCourseSettingsByName(
    courseName,
  );
  const localSources = [...new Set(sources)].filter(isLocalImageSource);

  let assets = settings.assets;
  let changed = false;
  const missing: string[] = [];

  for (const src of localSources) {
    const image = await readImage(src);
    if (!image) {
      missing.push(src);
      continue;
    }
    const existing = assets.find((a) => a.sourceUrl === src);
    if (existing && existing.hash === image.hash) continue;

    // uploaded before hashes were recorded: assume it is the same file rather
    // than re-uploading every image in the course once
    if (existing && !existing.hash) {
      assets = assets.map((a) =>
        a === existing ? { ...a, hash: image.hash } : a,
      );
      changed = true;
      continue;
    }

    console.log(`uploading ${src} to Canvas (${image.localPath})`);
    const { upload_url, upload_params } = await uploadToCanvasPart1(
      image.localPath,
      settings.canvasId,
    );
    const canvasUrl: string = await uploadToCanvasPart2({
      pathToUpload: image.localPath,
      upload_url,
      upload_params,
    });
    assets = [
      ...assets.filter((a) => a.sourceUrl !== src),
      { sourceUrl: src, canvasUrl, hash: image.hash },
    ];
    changed = true;
  }

  const updated = { ...settings, assets };
  if (changed)
    await fileStorageService.settings.updateCourseSettings(courseName, updated);

  if (missing.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Not published: ${missing.length === 1 ? "this image was" : "these images were"} not found, so ${missing.length === 1 ? "it" : "they"} would be broken in Canvas: ${missing
        .map((m) => `${m} (looked for ${localPathForImage(m) ?? "a path outside the public folder"})`)
        .join(", ")}`,
    });
  }
  return updated;
};
