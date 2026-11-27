# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Docs: [Migrating from Zod](docs/migrating-from-zod.md) and
  [Validating single values](docs/single-values.md).
- Docs: [Multi-step forms](docs/multi-step-forms.md), and a loan application in
  four steps in `examples/fullstack` (a key per step, a step validated with
  `pick`, a person or company branch, a follow-up question, server issues on
  their step).

### Changed

- The package is published to npm instead of GitHub Packages:
  `npm install @xopseasy/xoe-validator`, without a token. Remove
  `@xopseasy:registry=https://npm.pkg.github.com` from your `.npmrc`, or npm
  keeps installing from GitHub Packages.
- Deno is no longer a supported runtime or a development tool: the tests run on
  Vitest, linting and formatting on oxlint and oxfmt, the type check on `tsc`
  (`npm run verify`, `npm run bench`). The build moved to Vite 8 and TypeScript
  7; the browsers it targets and the type declarations are unchanged. Node 20 or later, Bun and browsers are
  supported as before.
- A transform that throws reports an issue with code `transform` ("Invalid
  value.", in `enMessages` and `srMessages`) instead of throwing from
  `validate()`; a coerce or preprocess function that throws leaves the value to
  the type check.
- An empty optional value skips `transform()` and `pipe()` as `undefined` (it
  was `""`, outside the output type). `pipe()` also skips the next validator for
  `null` of a nullable first validator.
- `required()` after `nullable()` makes `null` empty again, as its type says.
- Array `maxLength` is checked before the items: a too long array reports only
  `array.maxLength`.
- `record` key issues have `params.recordKey`; `record` and `xoe.jsonSchema`
  objects accept plain objects only (not `Map`, `Set` or class instances).
- `object.strict` issues have the unknown keys in `params.keys`.
- `default()` and `catch()` throw `UNCOPYABLE_VALUE` for values with class
  instances inside, which a copy would turn into plain objects.
- Rule registries (`stringRules`, ...), rule configs and the rule context are
  frozen, and `RuleContext` is read-only.
- `refine(check, options, code)` is a type error: pass the code in `options` or
  use `refine(check, message, code)`.
- `xoe.jsonSchema`: keywords without `type` apply to values of their type,
  `multipleOf` allows for floating point, string lengths count code points, a
  missing value reports one `required` issue, and anchors and keywords with the
  wrong kind of value throw `INVALID_SCHEMA`.
- `toJsonSchema` doesn't call function defaults and leaves out `refine` rules
  that reuse a built-in code.
- Bundle size limits in `scripts/size.mjs` are raised for these fixes (a form
  with named imports is about 9.1 KB gzipped).

### Fixed

- The Standard Schema `validate` of a validator with an async transform, default
  or catch returns a promise instead of throwing `ASYNC_IN_SYNC`.
- `validateAsync` validates holes of sparse arrays (it skipped them or threw),
  doesn't leave unhandled rejections when a check throws synchronously, and
  doesn't start queued async checks after it rejected.
- More than about 115,000 issues no longer throw `RangeError`.
- `catch(fallback).transform(fn)` transforms the fallback.
- `requiredFields()` keeps nullable fields, defaults and messages, and undoes
  every `partial()` layer; `partial()` keeps the defaults of transformed fields.
- `discriminatedUnion` works with `strict()` and `catchall()` options and keeps
  class and `Map` outputs.
- `minAge`/`maxAge` count date-only birth dates (UTC midnight) by their calendar
  day west of UTC too; `coerce.date()` rejects nonexistent dates with a space or
  `t` before the time.
- `url()` and the `uri` format reject control characters and surrounding spaces.
- Date params of issues that went through JSON are formatted by
  `localizeIssues`.
- The first validation of interlinked `lazy` schemas and `$ref`s, and
  `toJsonSchema` of them, take linear time (they took factorial time).
  `toFieldErrors`, `uniqueItems` and long async queues are linear too.
- `xoe.jsonSchema`: `oneOf` with `required`-only branches, defaults in `allOf`,
  `$ref` siblings, `prefixItems` and `additionalProperties`, and issues of
  additional properties next to invalid declared ones.
- `toJsonSchema`: nullable enums, literals and unions accept `null` (also for
  OpenAPI 3.0), OpenAPI 3.0 bounds keep only the tightest one, patterns are
  exported only when valid with the `u` flag, the discriminator `const` wins
  over a wider key schema, non-canonical numeric keys stay strings, and OpenAPI
  3.0 recursion with `unrepresentable: "any"` has no `$defs`.
- Changing an options object, a `Date` or a list passed to a validator or rule
  later no longer changes it; `setOwn` works with a frozen `Object.prototype`;
  `deepEqual` handles cycles, `-0`, holes, `Map` and `Set`; a fake `Date` no
  longer makes validation throw; type and literal messages no longer read
  `Object.prototype` names or drop array brackets.
- `catchall(v).passthrough()` keeps the catchall.

## [0.1.0-alpha.3] - 2026-10-27

### Added

- `localized(validator, messages)`: the validator with translated messages in
  `validate`, `validateAsync` and the Standard Schema interface, for form
  resolvers and other libraries that show `issue.message` (the catalog may be a
  function, e.g. of the current language).
- `examples/fullstack`: a React frontend and a Hono backend sharing their
  schemas (react-hook-form through Standard Schema, Serbian rules, server issues
  on form fields, OpenAPI), with API scenarios. It has its own `package.json`
  and isn't part of the package or CI.

### Changed

- Docs: create schemas once (building one costs more than validating), the
  current bundle sizes, the JSON Schema keywords `xoe.jsonSchema` ignores, to
  build validators only from trusted schemas (ReDoS), and the type of
  `optional()` with `emptyValues: "undefined"`. CI checks the bundle sizes
  (`npm run size`).

## [0.1.0-alpha.2] - 2026-10-27

### Added

- `deno task bench` compares xoe with Zod and Valibot (`bench/`).
- Rules for Serbia, `rsRules`: `jmbg()`, `pib()` and `companyNumber()` (matični
  broj), with their check digits, English and Serbian messages and a `pattern`
  in `toJsonSchema`.

### Changed

- Validation is about twice as fast: output keys are assigned (only `__proto__`
  is defined, so it still can't change the prototype), nested values get their
  context without object spread, and objects and arrays no longer build
  temporary arrays on every validation.

## [0.1.0-alpha.1] - 2026-10-24

The first internal release (GitHub Packages): a rewrite of the library around
one immutable, functional validator builder.

### Breaking changes

- `xoe.schema.*`, `createSchema` and `createRuleChain` are removed. Use the same
  validators everywhere and `xoe.object({ ... })` for objects.
- Errors are `XOEIssue` objects (`{ code, message, params, path }`) instead of
  strings. Use `toFieldErrors(issues)` for `{ "user.email": ["..."] }`.
- Values are required unless `optional()` (or `default()`) is used; `undefined`,
  `null` and `""` count as empty.
- Validation returns the parsed output: objects drop unknown keys
  (`passthrough()` keeps them, `strict()` reports them), and `coerce`, `trim`,
  `default` and `transform` apply.
- `validate(value, data)` / `validateAsync(value, data)` take an options object:
  `validate(value, { data })`.
- `asyncValidation` is replaced by `refineAsync`, array `each(rule)` by
  `xoe.array(itemValidator)`.
- `createRule` takes `{ code, message, check }` instead of
  `{ errorMessage, check }`; checks get `(value, data, { signal, isEmpty })`.
- `xoe.jsonSchema(schema)` returns a validator (call `.validate(data)`);
  `createSchemaValidator` is replaced by the `jsonSchema` named export.
- `coerce.number()` accepts only plain decimal notation (`"12"`, `"-3"`,
  `"0.5"`).
- The `XOEResult<T, E>` type replaces `XOEValidationResult<E, T>`, and the
  string-based result types (`XOEValidatorFn`, `XOESyncResult`, ...) are
  removed.

### Added

- Type declarations for `require` (`index.d.cts`), so CommonJS TypeScript
  projects get the types with every `moduleResolution`; `engines` (Node 20 or
  later). Source maps are no longer in the package (77 KB instead of 256 KB).

- Validators: `string`, `number`, `boolean`, `date`, `object`, `array`, `tuple`,
  `record`, `literal`, `enum`, `union`, `discriminatedUnion`, `lazy`, `unknown`,
  `instanceOf`, `file` and `jsonSchema`.
- `xoe.coerce.string/number/boolean/date()` for form fields and query params.
- `inFuture`/`inPast` take `{ now }` to pass in the clock.
- `with(...rules)` applies shared rule lists; the rule registries
  (`stringRules`, `numberRules`, ...) are exported.
- `pipe(next)` validates the output with another validator.
- Issues, paths, issue lists and field errors have readonly types.
- Rules: `email`, `url`, `uuid`, `length`, `startsWith`, `endsWith`, `integer`,
  `positive`, `nonNegative`, `negative`, `between`, `inFuture`, `inPast`,
  `nonEmpty`, `uniqueBy`, `isTrue`, `file.maxSize/minSize/accept`.
- Chain methods: `optional`, `required`, `default`, `transform`, `refine` (with
  a path for cross-field rules and type guards), `refineAsync`, `superRefine` /
  `superRefineAsync` (several issues from one check), `nullable`, `catch`,
  `sameAs`, `errorMessage`, `abortEarly`, `string.trim`.
- Object composition: `shape`, `pick`, `omit`, `partial`, `extend`, plus
  `requireOne`, `passthrough` and `strict`.
- `Infer` and `InferInput` types.
- Standard Schema v1 support (`~standard`) for libraries such as TanStack Form,
  tRPC and Hono.
- `localizeIssues(issues, messages)` for translated messages.
- `toJsonSchema(validator, { target })` describes validators as JSON Schema
  (draft 2020-12 / OpenAPI 3.1) or OpenAPI 3.0, e.g. for API documentation.
- `xoe.jsonSchema` supports `enum`, `const`, `pattern`, `format` (`email`,
  `uri`, `uuid`, `date`, `date-time`), `anyOf`, `oneOf`, `allOf`, local `$ref`
  (recursive, with `{ root }` for OpenAPI documents), exclusive bounds,
  `multipleOf`, `minItems`, `maxItems`, `uniqueItems`, `prefixItems`,
  `additionalProperties` schemas, boolean schemas, OpenAPI 3.0 `nullable` and
  `default` (`useDefaults: true`).
- `xoe.jsonSchema` infers the output and input types from literal (`as const`)
  schemas, including `$ref`s, `root` and `useDefaults`; `FromJsonSchema` and
  `FromJsonSchemaInput` give the same types without a validator.
- Type issues have `params.received`, the name of the value's type (`"string"`,
  `"null"`, `"nan"`, ...), next to `expected`.
- `validate(value, { reportInput: true })` (also `validateAsync`) adds the
  invalid value to each issue as `input`, for debugging and internal logs.
- Message catalogs `enMessages` and `srMessages` (Serbian Latin) for
  `localizeIssues`, covering every built-in issue code, with plural forms and
  local number and date formats.
- `localizeIssues` keeps messages you pass in (rule arguments, `required`,
  `errorMessage`, ...); their issues have `customMessage: true`.
- `defineValidator` for custom types and `factory.extend(rules)` for custom
  rules.
- `validateAsync` options: `concurrency` (default 10) and `signal` to cancel.
- `emptyValues: "undefined"` option for APIs where `""` and `null` are values.
- Result helpers: `fold`, `map`, `mapError`, `bimap`, `flatMap`, `flatMapAsync`,
  `all`, `tryCatch`, `fromPromise`. `map`, `mapError`, `bimap` and `tryCatch`
  reject async functions at the type level.
- Validators carry whether they are async in their type: `validate()` on an
  async validator is a type error (`IsAsync`, `AnyAsync` types).
- `XOEUsageError` with a `code` for incorrect use of the library.
- Named exports for every validator (`string`, `object`, `enumOf`, `coerce`,
  ...) so bundlers can tree-shake unused validators.
- ESM, CJS and UMD builds with type declarations, and an MIT license.
- More rules and methods: `string().toLowerCase()`, `toUpperCase()`, `date()`,
  `dateTime()`, `ip()`, `digits()`; `number().greaterThan()`, `lessThan()`,
  `maxDecimals()`, `safeInteger()`; `date().minAge()`, `maxAge()`;
  `array().length()`; `object().requiredFields()`, `keyof()`, `catchall()`;
  `enum().options`, `exclude()`, `extract()`; `meta()` and `describe()` on every
  validator, written to the schema by `toJsonSchema`. `xoe.jsonSchema` also
  checks the `ipv4` and `ipv6` formats.

### Changed

- The default messages are the English messages of `enMessages`, with plural
  forms ("1 character"), dates as `YYYY-MM-DD` in the runtime's time zone,
  "Invalid format." instead of the pattern, and "a list"/"text" in type
  messages. Both come from one place, so they can't drift apart.
- Async validation runs object fields, array items and async rules in parallel;
  async rules of a value only run when its other rules passed.
- JSON Schema validation is built from xoe validators, so it reports the same
  issues and follows JSON Schema semantics (`""` and `null` are values).

### Fixed

- Async checks always passed because `asyncValidation` didn't mark them as
  async; `refineAsync` runs them.
- `optional()` followed by rules no longer fails for present values.
- `regexMatch` with the global flag gives the same result on every call and no
  longer changes the `lastIndex` of the RegExp passed in.
- `xoe.number()` rejects `NaN` and `Infinity`.
- Rejected promises in `validate()` are no longer left unhandled.
- JSON Schema: a `type` array is a union, and an unknown type throws
  `INVALID_SCHEMA` instead of accepting any value.
- `default()` and `catch()` copy object, array and date values on every use, so
  results don't share them.
- `xoe.object()` and `xoe.array()` without a shape return a copy instead of the
  input.
- `coerce.date()` rejects ISO dates that don't exist (e.g. `"2024-02-30"`).
- `discriminatedUnion` accepts numeric discriminators (option key `1` matches
  `1` and `"1"`).
- The `lazy` getter runs once instead of on every validation.
- `record` reports `record.duplicateKey` when its key validator maps two keys to
  the same key, instead of silently dropping a value.

### Security

- Only own properties of the input are read and written, so keys such as
  `__proto__`, `constructor` or `toString` can't change prototypes or leak
  inherited values.
- `url()` accepts only `http` and `https` by default.

### Removed

- The legacy engine, chain helpers, `utils` and duplicated modules.
- `array().ofType(check)`: use `xoe.array(itemValidator)`, which also types the
  items and reports each one.
- `object().requiredKeys(keys)` and `noAdditionalKeys(keys)` (and the
  `objectRules` registry): use `xoe.object(shape)` with `strict()`, or `refine`
  for keys that are only known at runtime.
- `date().isDate()`: `xoe.date()` already rejects invalid dates.
- `getXOEError` and `getXOESuccess`, which threw on the other side of a result
  (and the `WRONG_RESULT_SIDE` usage error): use `result.type`, `isXOESuccess` /
  `isXOEError` or `fold`.

## [0.0.2-alpha.9]

Last version before the rewrite.

[Unreleased]: https://github.com/XOpsEasy/xoe-validator/compare/v0.1.0-alpha.3...HEAD
[0.1.0-alpha.3]: https://github.com/XOpsEasy/xoe-validator/compare/v0.1.0-alpha.2...v0.1.0-alpha.3
[0.1.0-alpha.2]: https://github.com/XOpsEasy/xoe-validator/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/XOpsEasy/xoe-validator/compare/797ccb4...v0.1.0-alpha.1
[0.0.2-alpha.9]: https://github.com/XOpsEasy/xoe-validator/tree/797ccb4
