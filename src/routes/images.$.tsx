import { createFileRoute } from "@tanstack/react-router";
import fs from "fs/promises";
import path from "path";
import { localPathForImage } from "@/features/canvas/services/files/publicImageFiles";

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// The production server only serves the files that were in public/ when the
// docker image was built. Faculty images are mounted into /app/public/images
// when the container starts, so they are read from disk here instead; without
// this every local image is broken in the preview while publishing works.
export const Route = createFileRoute("/images/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const filePath = localPathForImage(new URL(request.url).pathname);
        const contents = filePath
          ? await fs.readFile(filePath).catch(() => undefined)
          : undefined;
        if (!filePath || !contents)
          return new Response("Image not found", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        return new Response(new Uint8Array(contents), {
          headers: {
            "Content-Type":
              contentTypes[path.extname(filePath).toLowerCase()] ??
              "application/octet-stream",
            // the file can change on disk at any time; revalidate every load
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
            // an svg opened on its own must not run scripts as this site
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          },
        });
      },
    },
  },
});
