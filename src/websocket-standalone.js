import { createServer } from "node:http";
import { Server } from "socket.io";
import chokidar from "chokidar";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const port = 3001;
const folderToWatch = path.join(process.cwd(), "./storage", "/");
console.log("watching folder", folderToWatch);
const usePolling = process.env.FILE_POLLING === "true";
const enable_images = process.env.NEXT_PUBLIC_ENABLE_FILE_SYNC === "true";
console.log("FILE_POLLING:", usePolling);
console.log("NEXT_PUBLIC_ENABLE_FILE_SYNC:", enable_images);

// build and dependency folders inside a course's files (a Rust target, a
// node_modules) hold thousands of files nobody edits by hand: not watched,
// which also spares the system's file-watch budget
const unwatched = /[\\/](\.git|node_modules|target|bin|obj|__pycache__|\.pytest_cache|\.venv|\.idea|\.vs|\.vscode)([\\/]|$)/;
const watcher = chokidar.watch(folderToWatch, {
  persistent: true,
  usePolling,
  ignored: (path) => unwatched.test(path),
  // only changes from now on: the first scan of the tree would otherwise report every
  // file as added, for minutes on a big tree, to every window that connects meanwhile
  ignoreInitial: true,
});
// it shares a process with the web server, so a watcher error only stops
// the live updates
watcher.on("error", (error) => console.error("file watcher error:", error));

// Only the app's own pages (and programs that aren't browsers) may listen for
// file changes; a website open in the same browser may not. The app's proxy in
// front of this server rewrites Host, so the Origin can't be compared with it
// as in src/services/requestGuard.ts. Instead, the app's client always opens
// with a same-origin request (polling, then upgrading), which browsers mark
// Sec-Fetch-Site: same-origin and send without an Origin in older browsers. A
// request with an Origin but no Sec-Fetch-Site is a cross-origin browser
// connection (Chromium sends none on a WebSocket handshake), which the app
// never makes.
const fromThisApp = ({ headers }) => {
  const site = headers["sec-fetch-site"];
  if (site) return site === "same-origin" || site === "none";
  return !headers.origin;
};

const httpServer = createServer();
const io = new Server(httpServer, {
  allowRequest: (request, callback) => callback(null, fromThisApp(request)),
});

// Changes are sent to every window in batches: the files changed within a
// quarter second go out as one message (a save, a git pull or a build change
// many files at once), each path once, so a window invalidates once per
// batch instead of once per file per window.
const pending = new Set();
let flushTimer;
const flush = () => {
  flushTimer = undefined;
  const paths = [...pending];
  pending.clear();
  console.log(`Sending ${paths.length} file change(s) to ${io.engine.clientsCount} window(s)${paths.length <= 3 ? ": " + paths.join(", ") : ""}`);
  io.emit("filesChanged", paths);
};
const changed = (filePath) => {
  pending.add(filePath.replace(folderToWatch, ""));
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 250);
};
watcher.on("change", changed);
watcher.on("unlink", changed);
watcher.on("add", changed);
// a module folder added, renamed or removed changes the module list
const folderChanged = (folderPath) => io.emit("folderChanged", folderPath.replace(folderToWatch, ""));
watcher.on("addDir", folderChanged);
watcher.on("unlinkDir", folderChanged);
io.on("connection", (socket) => {
  console.log("websocket connection created");
  socket.on("disconnect", () => console.log("Client disconnected"));
});

httpServer
  .once("error", (err) => {
    console.error(err);
    process.exit(1);
  })
  .listen(port, () => {
    console.log(`> WebSocket server ready on port ${port}`);
  });
