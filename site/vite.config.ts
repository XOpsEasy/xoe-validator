import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { content } from "./plugins/content.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  // Relative asset URLs and hash routes: the build works from any folder of
  // any static host (GitHub Pages, S3, ...), without rewrite rules.
  base: "./",
  plugins: [content({ repoRoot, docsDir: `${repoRoot}docs` }), react()],
  resolve: {
    alias: {
      // The library runs from its source, see tsconfig.json.
      "@x-ops-easy/xoe-validator": `${repoRoot}src/index.ts`,
    },
  },
  server: { fs: { allow: [repoRoot] } },
});
