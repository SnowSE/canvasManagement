import "dotenv/config";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-oxc";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  test: {
    environment: "node",
    pool: "forks",
    execArgv: ["--max-old-space-size=4096"],
    exclude: [
      "**/.pnpm-store/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/.claude/worktrees/**",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
