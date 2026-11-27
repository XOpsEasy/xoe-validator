# Input and output

The success value is the parsed output, not the input: trimmed and coerced
values, defaults, transforms and objects without unknown keys. The input is
never mutated.

## Types

```ts
import xoe, { Infer, InferInput } from "@x-ops-easy/xoe-validator";

const signUp = xoe.object({
  name: xoe.string().trim(),
  age: xoe.coerce.number().optional(),
  role: xoe.enum(["admin", "user"]).default("user"),
});

type SignUp = Infer<typeof signUp>; // { name: string; age?: number | null; role: "admin" | "user" }
type SignUpForm = InferInput<typeof signUp>; // age: string | number, role is optional
```

`InferInput` is the type a validator accepts: e.g. `string | number` for
`xoe.coerce.number()`, and an optional key for fields with `optional()` or
`default()`. `Infer` is the type it returns.

## Coercion

`xoe.coerce.string()`, `.number()`, `.boolean()` and `.date()` convert raw input
(form fields, query params, JSON) before validating it:

```ts
const query = xoe.object({
  page: xoe.coerce.number().minimum(1).default(1),
  active: xoe.coerce.boolean().optional(), // "true" | "1" | "on" | "yes" ...
  since: xoe.coerce.date().optional(), // ISO string (or a number timestamp)
  search: xoe.string().trim().optional(),
});

query.validate({ page: "2", active: "on", extra: "x" });
// { type: "success", value: { page: 2, active: true } }
```

Values that can't be converted are reported by the type check (code `type`).

- `coerce.date()` rejects ISO dates that don't exist (`"2024-02-30"` would
  otherwise become March 1), also with a space or `t` before the time
  (`"2024-02-30 10:00"`). A coerce function that throws leaves the value as it
  is, so the type check reports it. Prefer ISO strings (`"2024-05-01"`,
  `"2024-05-01T10:00:00Z"`) or timestamps, since other formats are parsed by
  JavaScript's `Date` and can differ between runtimes.
- `coerce.number()` accepts plain decimal notation only (`"12"`, `"-3"`,
  `"0.5"`, `".5"`); hex, binary, octal, exponents (`"1e3"`), `"Infinity"` and
  decimal commas (`"1,5"`) are rejected.
- Like every JavaScript number, the result is exact only up to
  `Number.MAX_SAFE_INTEGER` (9007199254740991): `"12345678901234567890"` becomes
  `12345678901234567000`. Keep large IDs as strings (`xoe.string().digits()`),
  or reject unsafe integers with `xoe.coerce.number().safeInteger()`.

## Validation order

preprocess (coerce, trim) → default → required/optional → type check → array
`maxLength` → nested values (object fields, array items) → own rules →
transform.

Own rules of objects and arrays (`refine`, `requireOne`, ...) see the parsed
nested values and are skipped when a nested value is invalid.
