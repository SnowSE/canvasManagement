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

const watcher = chokidar.watch(folderToWatch, {
  persistent: true,
  usePolling,
});

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

io.on("connection", (socket) => {
  console.log("websocket connection created");
  const changeHandler = (filePath) => {
    const relativePath = filePath.replace(folderToWatch, "");
    console.log(`Sending file changed websocket message: ${relativePath}`);
    socket.emit("fileChanged", relativePath);
  };
  // a module folder added, renamed or removed changes the module list
  const folderHandler = (folderPath) =>
    socket.emit("folderChanged", folderPath.replace(folderToWatch, ""));
  watcher.on("change", changeHandler);
  watcher.on("unlink", changeHandler);
  watcher.on("add", changeHandler);
  watcher.on("addDir", folderHandler);
  watcher.on("unlinkDir", folderHandler);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    watcher.off("change", changeHandler);
    watcher.off("unlink", changeHandler);
    watcher.off("add", changeHandler);
    watcher.off("addDir", folderHandler);
    watcher.off("unlinkDir", folderHandler);
  });
});

httpServer
  .once("error", (err) => {
    console.error(err);
    process.exit(1);
  })
  .listen(port, () => {
    console.log(`> WebSocket server ready on port ${port}`);
  });
