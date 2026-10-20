import { defineConfig } from "vite";

// The live file-change server (src/websocket-standalone.js) bundled with its
// packages, so the image runs it without a node_modules folder.
export default defineConfig({
  build: {
    ssr: "src/websocket-standalone.js",
    outDir: ".output/websocket",
    emptyOutDir: true,
    copyPublicDir: false,
  },
  ssr: { noExternal: true },
});
