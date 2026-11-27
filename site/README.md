# The xoe-validator website

The documentation and the live form examples, as a static site.

- The documentation pages are the Markdown files of [`docs/`](../docs) and the
  root [README](../README.md), turned into HTML at build time
  (`plugins/content.ts`). Edit them there.
- Every example is a folder in `src/examples/` with a `Form.tsx` and the files
  shown under the demo. The page shows the files themselves, so the code on
  the page is the code that runs. Add an example to `src/examples/index.ts`.
- The library runs from `../src`, so the site always shows the current code.

It has its own `package.json`: the library's CI doesn't install or build it.

```sh
npm install
npm run dev      # http://localhost:5173
npm run verify   # type check and build to dist/
```

The build uses relative URLs and hash routes (`#/docs/async`), so `dist/` works
from any folder of any static host without rewrite rules.

## Hosting

GitHub Actions builds and deploys the site to GitHub Pages on pushes to
`main`. The workflow can also be run manually from the Actions tab. The
repository contains the source, not the generated `dist/` directory.

In repository Settings, under Pages, select GitHub Actions as the build and
deployment source.

## Logo

`public/logo.svg` is the mark: the three sheets of a carbon-copy form, with a
check on the top one. `public/favicon.svg` is a copy of it. The name next to it
is text, set in Archivo at a width of 66% and a weight of 900.
