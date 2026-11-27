# Composing validators

## Sharing rules

Share rule lists with `with(...rules)`; the rule registries (`stringRules`,
`numberRules`, `dateRules`, `arrayRules`, `booleanRules`, `fileRules`) and
`createRule` give the rules:

```ts
import xoe, { stringRules } from "@xopseasy/xoe-validator";

const passwordRules = [
  stringRules.minLength(8),
  stringRules.regexMatch(/\d/, "Add a digit"),
];
const password = xoe.string().with(...passwordRules);
const adminPassword = xoe
  .string()
  .with(...passwordRules)
  .minLength(12);
```

## Piping

`pipe(next)` validates the output with another validator, e.g. to parse JSON
first:

```ts
const settings = xoe
  .string()
  .transform((text) => JSON.parse(text) as unknown)
  .pipe(xoe.object({ theme: xoe.enum(["light", "dark"]) }));

xoe
  .string()
  .trim()
  .pipe(xoe.coerce.number())
  .pipe(xoe.number().between(0, 100));
```

The next validator must accept the output type (an `unknown` output, e.g. from
`JSON.parse`, is always accepted); otherwise it's a type error. Empty values of
an optional first validator skip the next one (`""` becomes `undefined`), and so
does `null` of a nullable first validator. Other outputs go to the next
validator, also `undefined` from a transform (so its `default()` applies). After
`pipe`, only more `pipe` calls can follow.

A transform that throws, like `JSON.parse` on `"not json"`, reports an issue
with code `transform` ("Invalid value."), so invalid data never throws. Use
`errorMessage()` for your own message.

Objects can be reused and combined too, see
[Reusing object schemas](objects.md#reusing-object-schemas).
