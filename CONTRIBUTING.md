# Contributing

## Setup

Node 26 and npm run everything (Vitest also accepts Node 24 and 22.12 or later
22.x):
`npm ci` installs the tools.

- `npm test` - run the tests ([Vitest](https://vitest.dev))
- `npm run check` - type check with TypeScript 7 (`tsc`): the library (`tsconfig.json`), then
  the tests and benchmarks (`tsconfig.test.json`); Vitest doesn't check types
- `npm run lint` / `npm run format` - lint and format
  ([oxlint](https://oxc.rs/docs/guide/usage/linter) with type-aware rules,
  [oxfmt](https://oxc.rs/docs/guide/usage/formatter))
- `npm run verify` - format check, lint, type check and tests; run it before a
  commit
- `npm run build` - build `dist`: Vite builds the JS (ESM, CJS, UMD), `tsc` type
  checks and `rollup-plugin-dts` bundles the declarations into one `index.d.ts`,
  copied to `index.d.cts` for `require`. TypeScript 7 has no compiler API, so
  `rollup-plugin-dts` uses `@typescript/typescript6`; that package also installs
  a `tsc` of its own, which is why the scripts call TypeScript 7 by path
- `npm run test:package` - build and check the package: "Are the types wrong?"
  (`attw`), then use it in an empty project (`test/package/`): `import` and
  `require` with your Node version, and the type declarations (ESM, CommonJS,
  bundler resolution) with TypeScript 5.0, 5.9, 6.0 and 7.0

Formatting and linting use only oxfmt and oxlint (no ESLint or Prettier). Turn
off other formatters in your editor (e.g. Prettier on save), or they'll reformat
whole files. oxfmt is pinned to an exact version in `package.json`: it is
pre-1.0 and its output can change between versions, so update it in its own
commit.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pull requests into `main`
and on pushes to it (pushes that change only `docs/` or Markdown files are
skipped). Its jobs:

- `verify` - `npm run verify`
- `build` - `npm run build`, the bundle sizes (`npm run size`), `npm pack` and
  `attw`
- `package` - `test/package/check.sh` with the packed package on Node 20, 22,
  24 and 26, and TypeScript 5.0, 5.9, 6.0 and 7.0

Rulesets require checks by job name, so keep the job names stable (versions go
in the step names). Pass values from the event (branch names, titles) to scripts
as environment variables, never as `${{ ... }}` inside `run`.

The repository is private, so runs use the free Actions minutes of the
organization (about 4-5 minutes per run). Keep jobs on Linux runners and avoid
adding jobs that run on every push to feature branches.

## Branches

The project uses GitHub flow: `main` is the only long-lived branch, and CI keeps
it working. Create a short-lived branch from an up-to-date `main` for each
change and open a pull request into `main`:

```sh
git switch main && git pull && git switch -c my-feature
```

Merging into `main` doesn't release anything: a release is a version tag (see
Releasing), made when there's something worth releasing. Changes since the last
release are listed under `Unreleased` in `CHANGELOG.md`.

## Code principles

The library follows functional programming principles. Keep new code in line
with them.

### Immutable data

- Validator state (`ValidatorState`) is never changed: `updateState` and
  `addRule` return a new state, and every chained call returns a new validator.
- Values passed in by users are never changed: inputs, shapes (copied and
  frozen), `RegExp` objects (`regexMatch` uses its own copy), option objects.
- Public types say so: issues, paths, issue lists and field errors are
  `readonly`.

### Local mutation only

Mutation is allowed only on values created inside the same function call and not
visible outside until the function returns, e.g. building the `issues` array or
the `output` object of a combinator, or a `for` loop on the sync path. Such
functions stay pure from the outside: the same input gives the same output and
nothing else changes.

This is a deliberate choice for speed on hot paths (measured; see Performance).
Prefer `map`/`filter`/`reduce` everywhere else.

Not allowed: changing arguments, module-level variables, or objects stored in
other validators.

Encapsulated state is fine when it can't be observed from outside: memoization
(`isAsyncTree`, the rule split cache), the recursion guard in `lazy`, and the
semaphore of `createLimit`.

### Pure functions and explicit dependencies

- Rules, combinators, `toFieldErrors` and `localizeIssues` are pure.
- Dependencies are passed in, not read from globals: the validation context
  (`data`, `signal`, `isEmpty`) is an argument, and time is injectable
  (`inFuture({ now })`). Avoid hidden inputs such as `Date.now()` or
  `Math.random()` without a way to pass them in.
- No global registries or global configuration: `factory.extend(rules)` returns
  a new factory, message catalogs are passed to `localizeIssues`.

### Errors as values

- Invalid data never throws: it becomes `XOEIssue` objects in an `XOEResult`.
- Only incorrect use of the library throws, as an `XOEUsageError` with a `code`.
- Rejected async checks are not validation issues and are passed on.
- New checks return results or issue lists (`superRefine`) instead of calling an
  `addIssue`-style callback.

### Effects at the edges

Async work, cancellation and concurrency limits live in the core
(`core/validator/baseValidator.ts`, `core/limit.ts`). One code path handles sync
and async with `MaybePromise` and `then`; don't add separate sync and async
implementations of the same logic.

### Types

- Keep `Infer`, `InferInput` and the async marker (`IsAsync`) accurate when
  adding chain methods or validators. A type may be wider than the runtime
  behavior, never narrower.
- Add type tests (`Equal<...>`, `@ts-expect-error`) for new inferred types.

## Conventions

- Structure: the core in `src/core`, one folder per validator type in
  `src/validators/<type>/` with its validator, its rules and a `tests/` folder.
- Issue codes are `<type>.<rule>` (`string.minLength`), plus `required`, `type`,
  `custom`, `sameAs`. Put rule arguments in `params` for translations.
- Rule factories take the message as the last argument, or an options object
  (`string | { message, ... }`).
- Set rule messages with `ruleMessage(message, defaultMessage)` and combinator
  issues with `issueWithMessage`, so a message passed in gets
  `customMessage: true` and `localizeIssues` keeps it.
- Write the English text of a new code once, in `src/core/english.ts`: the rule
  uses it as its default message and `enMessages` for localizeIssues (a test
  checks that they match). Add the code to `srMessages` too. Mark module-level
  calls of these functions `/* @__PURE__ */`, or bundlers keep the rules they
  belong to.
- Read and write input keys with `hasOwn`, `getOwn` and `setOwn`
  (`core/ownProperties.ts`), never `obj[key]` or `key in obj`, so keys such as
  `__proto__` can't change prototypes. The tests run with `unsafe-proto`
  enabled, as in Node and browsers.
- Mark module-level calls that build validators with `/* @__PURE__ */` so
  bundlers can tree-shake them.
- Members that users shouldn't call start with `~`, as in Standard Schema
  (`"~standard"`): `"~run"` (used by parent validators), `"~meta"` (used by
  `toJsonSchema`) and the type-only `"~async"`. They're internal and may change
  in any version; mark them `@internal`.
- Names, comments, docs and messages are in English. Rules of a country go in a
  registry named by its ISO code (`rsRules` in `src/countries/rs/`) with codes
  prefixed by it (`rs.jmbg`). An identifier keeps its official abbreviation when
  there is one in use (`jmbg`, `pib`, like `cpf` or `ssn`), otherwise it gets an
  English name (`companyNumber`); the JSDoc gives the full name. Test check
  digits with public numbers or made-up ones, never with a real person's data.
- Use `any` only where `unknown` can't work, with an
  `oxlint-disable-next-line` comment that says why. Use `AnyValidator` and `AnyRule` for "any validator" and "any
  rule".

## Tests

- Every change comes with tests; a bug fix with a test that fails without the
  fix.
- Test timing-dependent behavior (parallelism, aborts) by counting, not by
  measuring time.
- Type-only checks go in a function that is not called, so they don't run.
  Keep the line a `@ts-expect-error` is for on one line: add `// oxfmt-ignore`
  above the comment if the formatter would break it.
- No export may be named `then`: Vitest loads modules with `await`, which
  treats a module with a `then` export as a promise.

## Performance

The sync path is the hot path. For changes in the core, compare a large array of
objects and a wide object against the previous commit (run each a few times,
alternating) and keep the sync path allocation-free for passing rules.

`npm run size` measures typical bundles (a form with named imports, with
`import xoe`, with Serbian messages) minified and gzipped, and fails over the
limits in `scripts/size.mjs`. CI runs it. If a change has to make a bundle
bigger, raise the limit in the same pull request and say why.

`npm run bench` compares xoe with Zod and Valibot (`bench/`): the same schemas
and data in all three, for a valid and an invalid form, a nested object, a list
of 1000 objects and creating a schema. It first checks that the libraries agree
(same result, same output), so the comparison is fair. It builds the package
first and measures `dist`, the same kind of file as the other two. Read the results as
ratios (the summary compares each group with its fastest library), not times:
they depend on the machine. It doesn't run in CI (shared
runners give noisy numbers).

To find where the time goes, profile a loop and open the profile in Chrome
DevTools (Performance, "Load profile"):

```sh
node --cpu-prof --cpu-prof-dir=prof my-loop.mjs
```

Import the built package (`dist`) in the loop: Node can't run the source as it
is.

## Documentation and commits

- Document user-facing changes in `docs/` (one file per topic, listed in
  `docs/README.md` and the README) and add them to the `Unreleased` section of
  `CHANGELOG.md`. Keep the README short: installation, a first example and
  links.
- Commit messages follow
  [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`,
  `refactor:`, ...); mark breaking changes with `!` and a `BREAKING CHANGE:`
  footer.

## Examples

`examples/` holds apps that use the library, each with its own `package.json`
and lockfile: their dependencies (React, Hono, ...) never go into the library's,
the root `npm ci` doesn't install them and the tools leave the folder out
(`.oxlintrc.json`, `.oxfmtrc.json`, `tsconfig.json`, `vitest.config.ts`), so CI
doesn't see them. They use the library from the repository (`file:../..`),
built with `npm run build` in the root.

Run `npm test` in `examples/fullstack` before a release and after changing the
public API; update the example when the API changes.

## Releasing

Pushing a version tag publishes the package: `.github/workflows/release.yml`
checks that the tag matches `package.json` and is on `main`, runs the checks,
builds, publishes to GitHub Packages and creates a GitHub release with the notes
from `CHANGELOG.md`.

Until the library is public, releases are pre-releases (`0.1.0-alpha.1`,
`0.1.0-alpha.2`, ...). They get the `alpha` dist-tag, so
`npm install @xopseasy/xoe-validator` doesn't pick them; install them with
`@alpha` or the exact version.

1. Check that `npm test` passes in `examples/fullstack`.
2. On a branch from `main`: set the version
   (`npm version 0.1.0-alpha.2 --no-git-tag-version`, which updates
   `package-lock.json` too) and move the `Unreleased` changes in `CHANGELOG.md`
   under the new version and date, with the link at the end.
   `sh scripts/release-notes.sh 0.1.0-alpha.2` shows the notes the release will
   get.
3. Merge the pull request into `main`.
4. Tag `main` and push the tag:

   ```sh
   git switch main && git pull
   git tag v0.1.0-alpha.2
   git push origin v0.1.0-alpha.2
   ```

If the workflow fails before "Publish", fix it and push the tag again (delete it
first with `git push --delete origin <tag>` and `git tag -d <tag>`). A published
version can't be published again: release the next one.
