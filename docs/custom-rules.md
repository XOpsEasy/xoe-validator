# Custom rules and types

## Rules

Rules are created with `createRule`. Add them to a validator type with `extend`,
which returns a new factory (the original is not changed):

```ts
import xoe, { createRule } from "@x-ops-easy/xoe-validator";

const slug = (message?: string) =>
  createRule<string>({
    code: "string.slug",
    check: (value) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value),
    message: message ?? "Value must be a slug.",
  });

const string = xoe.string.extend({ slug });
string().trim().slug();
```

`extend` is available on `xoe.string`, `xoe.number`, `xoe.boolean` and
`xoe.date`. It can also replace a built-in rule (e.g. to change its default
message). Names of built-in methods (`optional`, `refine`, ...) are rejected.

A rule's `message` is the default message of its code, so a catalog with an
entry for the code translates it (see [Translations](translations.md)). To add a
rule to a single validator, use `with(rule)` or `refine` instead.

## Types

`defineValidator` creates a completely new type; the built-in types are made
with it too:

```ts
import { defineValidator } from "@x-ops-easy/xoe-validator";

const bigint = defineValidator({
  type: "bigint",
  check: (value): value is bigint => typeof value === "bigint",
  message: "Value must be a bigint.",
  rules: { maxDigits },
  coerce: (value) => (typeof value === "string" ? BigInt(value) : value),
});

bigint({ coerce: true }).maxDigits(20);
```

`defineValidator` also takes `preprocess`, applied to the raw input before
anything else (it is how `file` treats empty inputs).
