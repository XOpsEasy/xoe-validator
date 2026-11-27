import { defineConfig } from "vite";
import { resolve as pathResolve } from "node:path";

export default defineConfig({
  build: {
    // The targets Vite 5 built for ("modules"). Vite 8 would build for newer
    // browsers by default, above the ones the README lists.
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
    rolldownOptions: {
      input: {
        main: pathResolve(import.meta.dirname, "src/index.ts"),
      },
      output: {
        // The default export (xoe) and the named exports: CommonJS users get
        // require(...).default and the named exports.
        exports: "named",
        // Rolldown leaves "use strict" out of the CommonJS and UMD files by
        // default; without it they would run in sloppy mode.
        strict: true,
      },
    },
    outDir: "dist",
    lib: {
      entry: pathResolve(import.meta.dirname, "src/index.ts"),
      name: "XOEValidator",
      formats: ["es", "cjs", "umd"],
      fileName: (format) =>
        format === "cjs" ? "xoe-validator.cjs" : `xoe-validator.${format}.js`,
    },
    sourcemap: false,
  },
});
