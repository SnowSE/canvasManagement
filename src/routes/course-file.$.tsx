import fs from "fs/promises";
import path from "path";
import { createFileRoute } from "@tanstack/react-router";
import { courseFileOnDisk, previewBase } from "@/features/local/files/courseFileStorage";

// what a browser shows itself; anything else is offered as a download
const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/**
 * One of a course's files, as a preview shows it:
 * /course-file/<key>/<course>/<module>/files/<name>, its place in the
 * course, so its own relative addresses find the course's other files as
 * they do on disk. Nothing else in the course's folders is served.
 *
 * An HTML file is sandboxed: its scripts run, as they will in Canvas, but
 * as a page of no site, so they can't reach this app. A page of no site
 * can't prove it is the app's own either, which is how the app's API tells
 * (see requestGuard), and the stylesheets, scripts and images it loads from
 * beside it are asked for by that page. So this address is outside the API
 * and opens with a key instead: made when the server starts, told only to
 * the app's own pages (see previewBase), and part of the address, so the
 * file's relative addresses carry it. A website can't guess it; the files
 * are told not to pass it on (no referrer) to whatever they load from
 * elsewhere.
 */
export const Route = createFileRoute("/course-file/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [, , key, courseName, ...place] = new URL(request.url).pathname.split("/").map(decodeURIComponent);
        if (`/course-file/${key}` !== previewBase) return new Response("Not found", { status: 404 });
        const name = place.at(-1) ?? "";
        const file = await courseFileOnDisk(courseName, place.join("/")).then((localPath) => fs.readFile(localPath)).catch((e: Error) => e.message);
        if (typeof file === "string") return new Response(file, { status: 404 });
        return new Response(new Uint8Array(file), {
          headers: {
            "content-type": contentTypes[path.extname(name).toLowerCase()] ?? "application/octet-stream",
            "content-security-policy": "sandbox allow-scripts allow-forms allow-popups allow-modals",
            // a page of no site loads its modules and data from another origin, as the browser sees it
            "access-control-allow-origin": "*",
            "referrer-policy": "no-referrer",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
