# Migrating from Zod

Most Zod schemas translate method by method. The differences that change
behavior come first: read them before the tables.

## Differences in behavior

**Empty values are missing.** By default `undefined`, `null` and `""` are empty,
and a required value reports `required`:

| Input                         | Zod     | xoe                                          |
| ----------------------------- | ------- | -------------------------------------------- |
| `""` for `string()`           | valid   | `required`                                   |
| `null` for `optional()`       | invalid | valid (empty), type `T \| null \| undefined` |
| `""` for `coerce.number()`    | `0`     | `required`                                   |
| `"1e3"` for `coerce.number()` | `1000`  | `type` (plain decimals only)                 |

That's what forms need: an empty field is missing, not a value. For JSON APIs
where `""` and `null` are values, validate with `{ emptyValues: "undefined" }`:
then only `undefined` (a missing key) is empty, as in Zod.

**Nothing throws.** There's no `parse()`: `validate()` returns a result, like
`safeParse()`. Throw yourself if you need to:

```ts
const result = schema.validate(input);
if (result.type === "error") throw new Error("Invalid input");
const value = result.value;
```

**Async is in the types.** `validate()` on a schema with `refineAsync` (or
another async part) is a type error; use `validateAsync()`. In Zod, `parse()`
throws at runtime.

**Issues are data with xoe codes.** Codes are `<type>.<rule>`
(`string.minLength`, `number.integer`) instead of Zod's `too_small` or
`invalid_type`, and `params` holds the rule's arguments (`{ min: 3 }`), for
translations.

**Unknown keys are removed**, as in Zod's `z.object()`, and all issues are
collected, as in Zod.

## Parsing and types

| Zod                                 | xoe                                                                   |
| ----------------------------------- | --------------------------------------------------------------------- |
| `schema.safeParse(value)`           | `schema.validate(value)`                                              |
| `schema.safeParseAsync(value)`      | `schema.validateAsync(value)`                                         |
| `result.success`                    | `result.type === "success"`                                           |
| `result.data` / `result.error`      | `result.value` (the output, or the list of issues)                    |
| `schema.parse(value)`               | no throwing variant, see above                                        |
| `z.infer<typeof s>` / `z.output`    | `Infer<typeof s>`                                                     |
| `z.input<typeof s>`                 | `InferInput<typeof s>`                                                |
| `z.flattenError(error).fieldErrors` | `toFieldErrors(issues)` (dotted paths: `"user.email"`, `"tags.0"`)    |
| `z.config(z.locales.de())`          | `localizeIssues(issues, srMessages)`, `localized(schema, srMessages)` |
| `z.toJSONSchema(s)`                 | `toJsonSchema(s)`                                                     |
| `z.fromJSONSchema(json)`            | `xoe.jsonSchema(json)`                                                |

## Types

| Zod                                                                                              | xoe                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `z.string()`, `z.number()`, `z.boolean()`, `z.date()`                                            | the same: `xoe.string()`, ...                                                                          |
| `z.object()`, `z.array()`, `z.tuple()`, `z.record()`                                             | the same                                                                                               |
| `z.literal()`, `z.enum()`, `z.union()`, `z.lazy()`, `z.unknown()`, `z.file()`                    | the same (the named export of `enum` is `enumOf`)                                                      |
| `z.instanceof(C)`                                                                                | `xoe.instanceOf(C)`                                                                                    |
| `z.discriminatedUnion("type", [a, b])`                                                           | `xoe.discriminatedUnion("type", { a: shapeA, b: shapeB })`: keyed by the value, shapes without the key |
| `z.coerce.number()` (and others)                                                                 | `xoe.coerce.number()`: stricter, see above                                                             |
| `z.strictObject({...})`                                                                          | `xoe.object({...}).strict()`                                                                           |
| `z.looseObject({...})`                                                                           | `xoe.object({...}).passthrough()`                                                                      |
| `z.null()`, `z.undefined()`, `z.never()`, `z.bigint()`, `z.map()`, `z.set()`, `z.intersection()` | no equivalent yet: `instanceOf`, `refine` or [`defineValidator`](custom-rules.md)                      |

## Strings

| Zod                                                   | xoe                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `.min(n)` / `.max(n)` / `.length(n)`                  | `.minLength(n)` / `.maxLength(n)` / `.length(n)`                   |
| `.regex(re)`                                          | `.regexMatch(re)`                                                  |
| `.includes(s)` / `.startsWith(s)` / `.endsWith(s)`    | `.contains(s)` / `.startsWith(s)` / `.endsWith(s)`                 |
| `.email()`, `.url()`, `.uuid()` (or `z.email()`, ...) | `.email()`, `.url()`, `.uuid()`                                    |
| `z.iso.date()` / `z.iso.datetime()`                   | `.date()` / `.dateTime()` (`{ local: true }` without an offset)    |
| `z.ipv4()` / `z.ipv6()`                               | `.ip(4)` / `.ip(6)`, or `.ip()` for both                           |
| `.trim()`, `.toLowerCase()`, `.toUpperCase()`         | the same                                                           |
| `.nonempty()`                                         | not needed: `""` is empty, so a required string reports `required` |

## Numbers

| Zod                                              | xoe                                                        |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `.min(n)` / `.gte(n)`                            | `.minimum(n)`                                              |
| `.max(n)` / `.lte(n)`                            | `.maximum(n)`                                              |
| `.gt(n)` / `.lt(n)`                              | `.greaterThan(n)` / `.lessThan(n)`                         |
| `.int()` / `z.int()`                             | `.integer()`                                               |
| `.safe()`                                        | `.safeInteger()`                                           |
| `.positive()` / `.negative()` / `.nonnegative()` | `.positive()` / `.negative()` / `.nonNegative()`           |
| `.multipleOf(n)`                                 | `.divisibleBy(n)`, or `.maxDecimals(n)` for decimal places |

## Arrays, objects and enums

| Zod                                                  | xoe                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `.min(n)` / `.max(n)` / `.length(n)` / `.nonempty()` | `.minLength(n)` / `.maxLength(n)` / `.length(n)` / `.nonEmpty()`                   |
| `.pick({ a: true })` / `.omit({ a: true })`          | `.pick("a")` / `.omit("a")`                                                        |
| `.partial()` / `.required()`                         | `.partial()` / `.requiredFields()` (`required()` makes the object itself required) |
| `.extend({...})`, `.merge(b)`                        | `.extend({...})`, `.extend(b.shape)`                                               |
| `.keyof()`, `.catchall(s)`, `.shape`                 | the same                                                                           |
| `.strict()` / `.passthrough()`                       | the same                                                                           |
| `enum.options` / `.exclude()` / `.extract()`         | the same                                                                           |

## Modifiers and checks

| Zod                                                                       | xoe                                                            |
| ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `.optional()`                                                             | `.optional()`: also accepts `null` and `""`, see above         |
| `.nullable()`                                                             | `.nullable()`                                                  |
| `.nullish()`                                                              | `.optional()`                                                  |
| `.default(v)` / `.catch(v)`                                               | the same                                                       |
| `.refine(fn, "message")`                                                  | `.refine(fn, "message")`, also `{ message, code, path }`       |
| `.refine(...)` with `ctx` / `.superRefine((v, ctx) => ctx.addIssue(...))` | `.superRefine((v) => [{ message, path }])`: returns the issues |
| async `refine`                                                            | `.refineAsync(fn)`, then `validateAsync()`                     |
| `.transform(fn)` / `.pipe(s)`                                             | the same                                                       |
| `.describe(text)` / `.meta({...})`                                        | the same (written by `toJsonSchema`)                           |
| `.brand()` / `.readonly()`                                                | no equivalent                                                  |

## Example

```ts
// Zod
const user = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  age: z.coerce.number().int().gte(18).optional(),
  role: z.enum(["admin", "user"]).default("user"),
});
const result = user.safeParse(input);
if (!result.success) console.log(z.flattenError(result.error).fieldErrors);

// xoe
const user = xoe.object({
  name: xoe.string().trim().minLength(2),
  email: xoe.string().email(),
  age: xoe.coerce.number().integer().minimum(18).optional(),
  role: xoe.enum(["admin", "user"]).default("user"),
});
const result = user.validate(input);
if (result.type === "error") console.log(toFieldErrors(result.value));
```

Libraries that accept Zod through [Standard Schema](standard-schema.md)
(react-hook-form, TanStack Form, tRPC, Hono, ...) accept xoe the same way.
