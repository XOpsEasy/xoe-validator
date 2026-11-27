# From xoe to JSON Schema and OpenAPI

`toJsonSchema(validator)` describes a validator as a JSON Schema (draft 2020-12,
which is also the schema dialect of OpenAPI 3.1), e.g. for OpenAPI
documentation, form generators or LLM structured output. The schema you validate
with is the one you document:

```ts
import xoe, { toJsonSchema } from "@x-ops-easy/xoe-validator";

const createUser = xoe.object({
  email: xoe.string().email(),
  age: xoe.number().integer().minimum(18),
  role: xoe.enum(["admin", "user"]).default("user"),
});

toJsonSchema(createUser);
// { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object",
//   properties: { email: { type: "string", format: "email" },
//     age: { type: "integer", minimum: 18 },
//     role: { enum: ["admin", "user"], default: "user" } },
//   required: ["email", "age"] }

toJsonSchema(createUser, { target: "openapi-3.0" }); // nullable, enum, ...
```

For the other direction, see [Validating with JSON Schema](json-schema.md).

## How validators are described

- Fields with `optional()` or `default()` are not `required`; `strict()` gives
  `additionalProperties: false`; `nullable()` adds `null` (`nullable: true` for
  OpenAPI 3.0, `null` in the `enum` of enums and literals); `date` is a
  `date-time` string and `file` a `binary` string.
- `default(value)` is written as `default`; a function default isn't called (it
  makes a new value on every use), so it is left out.
- Rules map to keywords: lengths, `pattern` (`regexMatch` without flags or with
  only `u`, when the source is valid with the `u` flag JSON Schema uses,
  `contains`, `startsWith`, `endsWith`, `digits`), `format` (`email`, `uri`,
  `uuid`, `date`, `date-time`, `ipv4`, `ipv6`),
  `minimum`/`maximum`/`exclusiveMinimum`/`exclusiveMaximum`/`multipleOf`
  (`maxDecimals(2)` is `multipleOf: 0.01`; validators that check `multipleOf` by
  division need a tolerance for it, e.g. Ajv's `multipleOfPrecision`, while
  `xoe.jsonSchema` has one built in), `safeInteger` as an `integer` with bounds,
  `minItems`/`maxItems`/`uniqueItems`. Unions are `anyOf`, discriminated unions
  `oneOf`, tuples `prefixItems`, records `additionalProperties`/`propertyNames`,
  `catchall` `additionalProperties`.
- `meta()` and `describe()` add `title`, `description`, `examples` and
  `deprecated` (OpenAPI 3.0 gets the first example as `example`).
- `dateTime({ local: true })` has no `format` (`date-time` requires an offset),
  and `minAge`/`maxAge` are relative to now, so they are left out.
- Recursive `lazy` schemas use `$defs` and `$ref`. OpenAPI 3.0 has no `$defs`:
  there recursion throws `UNREPRESENTABLE`, or allows any value at the recursion
  point with `{ unrepresentable: "any" }`.

## What can't be described

- `refine`, `superRefine` and async rules have no JSON Schema equivalent and are
  left out (also when they reuse a built-in code), so the schema is less strict
  than the validator. `transform` and `pipe` describe the input. `coerce`
  validators are described by their type.
- Validators JSON Schema can't describe (`instanceOf`, custom types) throw
  `XOEUsageError` `UNREPRESENTABLE`; pass `{ unrepresentable: "any" }` to allow
  any value there.
