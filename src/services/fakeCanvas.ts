const canvasOrigin = "https://snow.instructure.com/";

/**
 * Where the server sends a Canvas request: to Canvas, or with a fake Canvas
 * set (CANVAS_FAKE_URL, for the walkthrough in the run-canvas-management skill) to the
 * same path there. The fake must be on this machine: the Canvas token goes
 * with every request.
 */
export function towardFakeCanvas(url: string, fake: string | undefined) {
  if (!fake || !url.startsWith(canvasOrigin)) return url;
  const { hostname } = new URL(fake);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") throw new Error(`CANVAS_FAKE_URL ${fake}: a fake Canvas runs only on this machine`);
  return fake.replace(/\/$/, "") + "/" + url.slice(canvasOrigin.length);
}
