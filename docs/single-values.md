# Validating single values

There's no difference between a schema and a validator: every validator
validates one value on its own, whenever you call it. You don't need an object
schema to check one value.

## One value

```ts
xoe.string().email().validate("ana@example.com");
// { type: "success", value: "ana@example.com" }

xoe.coerce.number().between(1, 100).validate(searchParams.get("page"));
xoe.string().with(rsRules.pib()).validate(input);
```

## Only a rule

A rule runs on its own with `execute`, without a validator (no type check, no
empty values):

```ts
import { rsRules, stringRules } from "@xopseasy/xoe-validator";

stringRules.email().execute("ana@example.com"); // XOEResult
rsRules.jmbg().execute(jmbg);
```

## Fields at different times

Validate a field when it changes (on blur, while typing) with the validator of
that field, and the whole object on submit, with the same rules and messages:

```ts
const signUp = xoe.object({
  email: xoe.string().email(),
  username: xoe.string().minLength(3).refineAsync(isUsernameFree),
});

signUp.shape.email.validate(email); // when the email field changes
await signUp.shape.username.validateAsync(username); // later, on blur
await signUp.validateAsync(form); // on submit
```

`pick` validates a few fields together: `signUp.pick("email").validate(form)`.

## A value that depends on another one

`sameAs` and other cross-field rules read the sibling values from `data`, so a
field can be validated on its own:

```ts
xoe.string().sameAs("password").validate(confirmPassword, {
  data: { password },
});
```

Rules of the whole object (`refine` on `xoe.object`) need the whole object:
validate it, or the fields they read with `pick(...).refine(...)`.

## In conditions

`validate(...).type === "success"` is the check; `result.value` is the output,
with `trim`, `coerce` and defaults applied:

```ts
const page = xoe.coerce.number().integer().minimum(1).validate(raw);
const current = page.type === "success" ? page.value : 1;
```
