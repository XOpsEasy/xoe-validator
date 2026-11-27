// Bundle sizes of typical uses of the package, minified and gzipped, as an
// app's bundler would produce them from dist/. Fails when one is over its
// limit, so growth is a decision: raise the limit in the same pull request.
//
//   npm run build && npm run size
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const cases = [
  {
    name: "a form with named imports",
    limit: 9_500,
    code: `
      import { boolean, coerce, number, object, string } from "./dist/xoe-validator.es.js";
      const form = object({
        name: string().minLength(2),
        age: coerce.number().minimum(18),
        terms: boolean().isTrue(),
        size: number().positive(),
      });
      console.log(form.validate({}));`,
  },
  {
    name: "the same form with import xoe",
    limit: 14_500,
    code: `
      import xoe from "./dist/xoe-validator.es.js";
      const form = xoe.object({
        name: xoe.string().minLength(2),
        age: xoe.coerce.number().minimum(18),
        terms: xoe.boolean().isTrue(),
        size: xoe.number().positive(),
      });
      console.log(form.validate({}));`,
  },
  {
    name: "Serbian messages (+ localizeIssues)",
    limit: 10_000,
    code: `
      import { localizeIssues, object, srMessages, string } from "./dist/xoe-validator.es.js";
      const result = object({ name: string().minLength(2) }).validate({});
      if (result.type === "error") console.log(localizeIssues(result.value, srMessages));`,
  },
];

let failed = false;
for (const { name, limit, code } of cases) {
  const result = await build({
    stdin: { contents: code, resolveDir: root, loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const size = gzipSync(result.outputFiles[0].contents).length;
  const over = size > limit;
  failed ||= over;
  console.log(
    `${over ? "✗" : "✓"} ${name}: ${(size / 1000).toFixed(2)} KB gzip (limit ${(
      limit / 1000
    ).toFixed(1)} KB)`,
  );
}
if (failed) {
  console.error(
    "\nA bundle is over its limit. Make it smaller, or raise the limit in scripts/size.mjs on purpose.",
  );
  process.exit(1);
}
