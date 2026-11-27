# Objects

```ts
const user = xoe.object({
  id: xoe.number().integer().positive(),
  email: xoe.string().email(),
  name: xoe.string().minLength(2),
});
```

## Unknown keys

`xoe.object(shape)` removes keys that are not in the shape from the output
(`xoe.object()` without a shape returns a shallow copy). `.passthrough()` keeps
them, `.strict()` reports them (code `object.strict`, with the unknown keys in
`params.keys` and the allowed ones in `params.allowedKeys`).

`xoe.object()` accepts any object that is not an array or a `Date`, including
class instances and `Map`. The output is a plain object with the own enumerable
fields, so a prototype and its methods are not kept (and a `Map` has no such
fields). Use `xoe.instanceOf(Class)` to accept instances as they are.

`catchall(validator)` validates the other keys with a validator and keeps them
in the output:

```ts
const settings = xoe
  .object({ theme: xoe.enum(["light", "dark"]) })
  .catchall(xoe.coerce.number());

settings.validate({ theme: "dark", fontSize: "14" });
// { type: "success", value: { theme: "dark", fontSize: 14 } }
// type: { theme: "light" | "dark"; [key: string]: number | "light" | "dark" }
```

Like `pick` and `extend`, it returns a new object validator, so call it before
`refine`. `passthrough()` after it changes nothing (the other keys are already
kept), and `strict()` replaces it (the other keys are reported). The index type
of the output also has the field types, as TypeScript requires.

Only own properties are read, so keys such as `__proto__` in the input can't
change prototypes.

## Reusing object schemas

```ts
const createUser = user.omit("id"); // { email; name }
const updateUser = createUser.partial().strict(); // all optional, no extra keys
const login = user.pick("email"); // { email }
const admin = user.extend({ permissions: xoe.array(xoe.string()) });

user.shape.email; // the field validators (frozen)
```

- `partial()` makes all fields optional, `partial("a", "b")` only those;
  `requiredFields()` / `requiredFields("a", "b")` make them required again, e.g.
  a create schema from an update schema. They only restore presence: nullable
  fields stay nullable, defaults and messages stay, and fields that are already
  required are kept as they are. (`required(message)` is the method of every
  validator that makes the object itself required.)
- `keyof()` is an `enum` of the field names, e.g.
  `sortBy: user.keyof().default("name")`.
- `extend(shape)` adds fields and replaces fields with the same name; combine
  two schemas with `a.extend(b.shape)`.
- They return a new object validator with only the fields: object settings
  (`strict`, `passthrough`, `refine`, `requireOne`, `optional`, `default`) are
  not copied, so a `refine` can't run against a field that was removed. Add them
  again where needed.

## Cross-field validation

Use `refine` on the object and report the issue on a field with `path` (relative
to the object):

```ts
const booking = xoe
  .object({
    startDate: xoe.coerce.date(),
    endDate: xoe.coerce.date(),
    isCompany: xoe.coerce.boolean().default(false),
    vatNumber: xoe.string().trim().optional(),
  })
  .refine((v) => v.endDate > v.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  })
  .refine((v) => !v.isCompany || Boolean(v.vatNumber), {
    message: "VAT number is required for companies",
    code: "required",
    path: ["vatNumber"],
  });
```

`superRefine` returns any number of issues from one check, each with a `message`
and optionally a `code` (default `custom`), a relative `path` and `params`;
return `[]` (or nothing) when the value is valid. It fits checks that look at
many values at once:

```ts
const schedule = xoe
  .object({
    shifts: xoe.array(xoe.object({ start: xoe.number(), end: xoe.number() })),
  })
  .superRefine(({ shifts }) =>
    shifts.flatMap((shift, i) =>
      shift.end <= shift.start
        ? [
            {
              code: "shift.order",
              message: "End must be after start",
              path: ["shifts", i, "end"],
            },
          ]
        : [],
    ),
  );
```

`superRefineAsync` is the async variant and runs like `refineAsync`.

The object's `refine` receives the parsed values (trimmed, coerced, defaults),
so it is also the right place to compare fields that use `trim` or `coerce`;
`sameAs` compares with the raw sibling value.

Object refinements only run when all fields are valid. A form with an empty
required field and a wrong date range first reports only the required field.

`requireOne(message?)` reports `object.requireOne` when every field is empty.
