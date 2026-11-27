import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    // The API runs on port 3001 (npm run dev starts both).
    proxy: { "/api": "http://localhost:3001" },
    // xoe-validator comes from the repository root (file:../..).
    fs: { allow: [repoRoot] },
  },
});
