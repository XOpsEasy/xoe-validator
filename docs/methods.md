# Common methods

Every validator has these methods. Each call returns a new validator; the
original is not changed.

## Empty values

- `required(message?)` - values are required by default; `undefined`, `null` and
  `""` count as empty (code `required`). After `nullable()` it makes `null`
  empty again. For JSON APIs where `""` and `null` are values, validate with
  `{ emptyValues: "undefined" }`: then only `undefined` (a missing key) is
  empty.
- `optional()` - empty values pass, present values are still validated. Its type
  includes `null` (`T | null | undefined`), since `null` is empty by default;
  with `{ emptyValues: "undefined" }` `null` is a value and fails, so the type
  is wider than what passes.
- `nullable()` - `null` is a valid value (it passes and stays `null`);
  `undefined` and `""` are still empty, unlike `optional()`.
- `default(value)` - used when the value is empty; pass a function for a fresh
  value on every use (`default(() => [])`). The default is validated too.
  `default()` also replaces `null`, so a validator with a default never returns
  `null` (even with `nullable()`). Object, array and date values (for `default`
  and `catch`) are copied on every use, so changing one result can't leak into
  the next; for values that can't be copied (e.g. with functions or class
  instances inside) `default()` and `catch()` throw `XOEUsageError`
  `UNCOPYABLE_VALUE`: pass a function that returns a new value instead.

`validator.isOptional` tells whether the input may be empty (`optional()` or
`default()`), e.g. to mark required form fields.

## Issues

- `errorMessage(message)` - replace the message of every issue of this value
  (codes are kept).
- `abortEarly()` - stop at the first issue (by default all issues are
  collected).
- `catch(fallback)` - returns the fallback instead of failing, e.g. for query
  params: `xoe.coerce.number().minimum(1).catch(1)`. A function gets
  `(issues, input)`. It applies to the whole validator and only replaces
  validation issues, not rejected async checks. With `transform()` after it, the
  fallback is transformed too.

## Custom checks

- `refine(check, message?, code?)` / `refineAsync(check, message?, code?)` -
  custom rules (default code `custom`). Instead of `message` you can pass
  `{ message, code, path }`, see
  [Cross-field validation](objects.md#cross-field-validation). Checks get
  `(value, data, { signal, isEmpty })`. A type guard narrows the output type:
  `xoe.string().refine((v): v is "admin" | "user" => ...)`.
- `superRefine(check)` / `superRefineAsync(check)` - like `refine`, but the
  check returns a list of issues, see
  [Cross-field validation](objects.md#cross-field-validation).
- `sameAs(field, message?)` - compare with a sibling field using deep equality
  (code `sameAs`). When validating a single value, pass the siblings with
  `validate(value, { data: { password } })`.

Async checks are described in [Async validation](async.md).

## Documentation

- `meta({ title, description, examples, deprecated })` documents the value;
  later calls are merged. `describe(text)` is `meta({ description: text })`.
  Validation doesn't read it: [toJsonSchema](to-json-schema.md) writes it to the
  schema, e.g. for OpenAPI documentation.

```ts
const age = xoe
  .number()
  .integer()
  .minimum(18)
  .meta({ title: "Age", examples: [30] })
  .describe("Age in full years");
```

## Output

- `transform(fn)` - map the valid value to the output (runs after all rules).
  After `transform` only further `transform` calls can be chained. A transform
  that throws reports code `transform`; an async transform that rejects makes
  `validateAsync` reject, like a rejected async check. An empty optional value
  skips the transforms and becomes `undefined`.
- `with(...rules)` and `pipe(next)` - see [Composing validators](composing.md).
