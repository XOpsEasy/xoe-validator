# Unions, records and recursion

```ts
xoe.literal("admin"); // "admin"                     code "literal"
xoe.enum(["admin", "user", "guest"]); // "admin" | "user" | "guest"   code "enum"
xoe.union([xoe.number().integer(), xoe.string().uuid()]); // number | string   code "union"

// Picks the shape by the value of "method"; the key stays in the output.
const payment = xoe.discriminatedUnion("method", {
  card: xoe.object({ cardNumber: xoe.string().length(16) }),
  paypal: xoe.object({ email: xoe.string().email() }),
});
// { method: "card"; cardNumber: string } | { method: "paypal"; email: string }
// unknown method -> code "discriminator" on path ["method"]
// numeric keys work too: { 1: ..., 2: ... } accepts version 1 (or "1")

xoe.record(xoe.number()); // Record<string, number>
xoe.record(xoe.enum(["eur", "usd"]), xoe.coerce.number()); // Partial<Record<"eur" | "usd", number>>

// Recursive schemas need an explicit type annotation.
type Category = { name: string; children: Category[] };
const category: Validator<Category> = xoe.object({
  name: xoe.string(),
  children: xoe.array(xoe.lazy(() => category)),
});
```

- `union` tries the validators in order and returns the output of the first
  match. When none matches it reports one `union` issue; prefer
  `discriminatedUnion` for objects, it reports the issues of the selected shape.
- `literal` and `enum` accept strings, numbers and booleans. Because `""` counts
  as empty, `literal("")` reports `required`.
- `enum` is a reserved word, so its named export is `enumOf`.
- `xoe.enum([...]).options` are the allowed values (e.g. for a `<select>`);
  `exclude(["guest"])` and `extract(["admin"])` make an enum with fewer values.
- Put `optional()` / `default()` on the union itself, not on its options.
- The `lazy` getter runs once, on first use.
- When a `record` key validator maps two keys to one (e.g. with `trim()`), the
  second key reports `record.duplicateKey` instead of overwriting the first.
- Issues of a `record` key validator have the entry's path, like issues of the
  value, and `params.recordKey` with the key (with `reportInput`, their `input`
  is the key). `record` accepts plain objects only: a `Map`, `Set` or class
  instance reports `type`.
- `discriminatedUnion` passes the object without the discriminator to `strict()`
  and `catchall()` options whose shape doesn't declare it, so they work; the key
  is added back to plain-object outputs. Other options get the whole object, so
  their checks see the key. An option that transforms to a class instance or a
  `Map` returns it as it is.
