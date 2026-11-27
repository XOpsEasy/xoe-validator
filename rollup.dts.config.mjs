// Bundles the type declarations into one file, so the same file also works
// as the CommonJS declaration (index.d.cts) for require.
import { dts } from "rollup-plugin-dts";

export default {
  input: "src/index.ts",
  output: [
    { file: "dist/index.d.ts", format: "es" },
    { file: "dist/index.d.cts", format: "es" },
  ],
  plugins: [dts({ tsconfig: "tsconfig.json" })],
};
