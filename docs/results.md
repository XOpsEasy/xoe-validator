# Working with results

`XOEResult<T, E>` is
`{ type: "success", value: T } | { type: "error", value: E }`. Helpers:
`isXOESuccess`, `isXOEError`, `fold`, `map`, `mapError`, `bimap`, `flatMap`,
`flatMapAsync`, `all`, plus `tryCatch` and `fromPromise` to turn code that
throws or rejects into results:

```ts
import {
  flatMap,
  mapError,
  toFieldErrors,
  tryCatch,
} from "@xopseasy/xoe-validator";

const parsed = tryCatch(
  () => JSON.parse(text) as unknown,
  () => [jsonIssue],
);
const result = mapError(
  flatMap(parsed, (value) => schema.validate(value)),
  toFieldErrors,
);
```

`flatMapAsync` chains async steps: the result and the step may be promises, and
errors short-circuit. E.g. validate, then load:

```ts
const user = await flatMapAsync(idSchema.validate(input), (id) => loadUser(id));
```

`map`, `mapError`, `bimap` and `tryCatch` don't accept async functions: it's a
type error, because a promise would end up inside the result. Use `flatMapAsync`
or `fromPromise` for async work.
