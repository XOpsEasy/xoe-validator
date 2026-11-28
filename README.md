# XOE Validator

Type-safe validation for frontend and backend, in Node and browsers.

Documentation and live form examples: <https://validator.xopseasy.org/>

- One immutable, chainable builder: every call returns a new validator.
- Invalid data never throws: results hold issues with codes, params and paths.
- Typed input and output, sync and async validation with cancelling and
  concurrency limits.
- JSON Schema and OpenAPI in both directions, English and Serbian messages,
  [Standard Schema](https://standardschema.dev) support.

## Installation

```sh
npm install @x-ops-easy/xoe-validator
```

Before 1.0.0, a minor version (0.2.0, 0.3.0, ...) can change the API; see
[CHANGELOG.md](https://github.com/XOpsEasy/xoe-validator/blob/main/CHANGELOG.md).

### Requirements

- Node 20 or later, Bun, or a browser from 2022 or later (Chrome 98,
  Firefox 94, Safari 15.4).
- TypeScript 5.0 or later with `strict: true`. ESM and CommonJS projects and
  bundlers (`moduleResolution` `nodenext`, `node16`, `bundler`) are tested with
  TypeScript 5.0, 5.9, 6.0 and 7.0.

## Usage

```ts
import xoe, {
  type Infer,
  type InferInput,
  toFieldErrors,
} from "@x-ops-easy/xoe-validator";

xoe.string().minLength(3).validate("jo");
// { type: "error", value: [{ code: "string.minLength", params: { min: 3 }, path: [], message: "..." }] }

const signUp = xoe.object({
  name: xoe.string().minLength(3),
  email: xoe.string().email().optional(),
  password: xoe.string().minLength(8),
  confirmPassword: xoe.string().sameAs("password", "Passwords do not match"),
  age: xoe.coerce.number().minimum(18),
  terms: xoe.boolean().isTrue("You must accept the terms"),
  tags: xoe.array(xoe.string()).maxLength(5).optional(),
});

type SignUp = Infer<typeof signUp>; // output type
type SignUpForm = InferInput<typeof signUp>; // input type (before coerce/default)

const result = signUp.validate(data);
if (result.type === "success") {
  result.value; // SignUp: parsed, without unknown keys
} else {
  toFieldErrors(result.value);
  // { name: ["..."], confirmPassword: ["Passwords do not match"], "tags.1": ["..."] }
}
```

Create a schema once, at module level, and reuse it: building a schema costs
more than validating with it, so don't build it in a React component or in a
loop.

Each issue is an object:

```ts
{ code: "string.minLength", message: "...", params: { min: 3 }, path: ["name"] }
```

so it can be translated (`localizeIssues(issues, srMessages)`), sent from an API
or mapped to form fields. See [Issues and errors](https://validator.xopseasy.org/#/docs/errors).

Import types with `type` (`type Infer`, `type XOEIssue`, ...): projects with
`verbatimModuleSyntax`, such as the Vite templates, require it.

### Named imports

Every validator is also a named export. Importing only what you use lets
bundlers drop the rest (the `xoe` object always includes every validator):

```ts
import { coerce, object, string } from "@x-ops-easy/xoe-validator";

const user = object({ name: string().minLength(2), age: coerce.number() });
```

A form with `object`, `string`, `number`, `boolean` and `coerce` is about 9.1 KB
minified and gzipped, against 13.7 KB with `import xoe` (`npm run size` in this
repository measures it).

## Documentation

- [Migrating from Zod](https://validator.xopseasy.org/#/docs/migrating-from-zod)
- [Validators and rules](https://validator.xopseasy.org/#/docs/validators)
- [Validating single values](https://validator.xopseasy.org/#/docs/single-values)
- [Objects](https://validator.xopseasy.org/#/docs/objects)
- [Unions, records and recursion](https://validator.xopseasy.org/#/docs/unions-and-records)
- [Common methods](https://validator.xopseasy.org/#/docs/methods)
- [Input and output](https://validator.xopseasy.org/#/docs/input-and-output)
- [Composing validators](https://validator.xopseasy.org/#/docs/composing)
- [Async validation](https://validator.xopseasy.org/#/docs/async)
- [Multi-step forms](https://validator.xopseasy.org/#/docs/multi-step-forms)
- [Issues and errors](https://validator.xopseasy.org/#/docs/errors)
- [Working with results](https://validator.xopseasy.org/#/docs/results)
- [Translations](https://validator.xopseasy.org/#/docs/translations)
- [Country rules](https://validator.xopseasy.org/#/docs/country-rules)
- [Custom rules and types](https://validator.xopseasy.org/#/docs/custom-rules)
- [Validating with JSON Schema](https://validator.xopseasy.org/#/docs/json-schema)
- [From xoe to JSON Schema](https://validator.xopseasy.org/#/docs/to-json-schema)
- [Standard Schema](https://validator.xopseasy.org/#/docs/standard-schema)

## Examples

[examples/fullstack](https://github.com/XOpsEasy/xoe-validator/tree/main/examples/fullstack): a React frontend and a Hono backend
sharing their schemas, with react-hook-form, Serbian rules, server issues on
form fields and OpenAPI.

## Contributing

See [CONTRIBUTING.md](https://github.com/XOpsEasy/xoe-validator/blob/main/CONTRIBUTING.md) for development, releases, the code
principles (functional style, local mutation only, errors as values) and the
project conventions.

## Changelog

See [CHANGELOG.md](https://github.com/XOpsEasy/xoe-validator/blob/main/CHANGELOG.md).

## License

MIT, see [LICENSE](https://github.com/XOpsEasy/xoe-validator/blob/main/LICENSE).
