# Validating with JSON Schema

`xoe.jsonSchema(schema)` builds an xoe validator from a JSON Schema, so it
reports the same issues (codes, messages, paths), works with `validateAsync`,
`toFieldErrors` and `localizeIssues`, and can be used inside other schemas.

```ts
const user = xoe.jsonSchema({
  type: "object",
  required: ["id", "email"],
  properties: {
    id: { type: "integer", minimum: 1 },
    email: { type: "string", minLength: 3 },
    tags: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
});

user.validate({ id: 0, email: "a@b.io", extra: true });
```

For the other direction, see [From xoe to JSON Schema](to-json-schema.md).

## Supported keywords

| Area         | Keywords                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| any value    | `type` (a type or an array of types), `enum`, `const`, `anyOf`, `oneOf`, `allOf`, `$ref` |
| strings      | `minLength`, `maxLength`, `pattern`, `format`                                            |
| numbers      | `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`               |
| arrays       | `items`, `prefixItems`, `minItems`, `maxItems`, `uniqueItems`                            |
| objects      | `properties`, `required`, `additionalProperties` (`false` or a schema)                   |
| OpenAPI 3.0  | `nullable`, boolean `exclusiveMinimum`/`exclusiveMaximum`, `definitions`                 |
| with options | `default` (`useDefaults: true`)                                                          |

Other keywords are ignored, so a schema that uses them is less strict as a
validator than it reads: `not`, `if`/`then`/`else`, `dependentRequired`,
`dependentSchemas`, `patternProperties`, `propertyNames`, `minProperties`,
`maxProperties`, `contains`, `minContains`/`maxContains`,
`unevaluatedProperties`/`unevaluatedItems` and `$ref` to other documents.
Without `type`, the keywords of a type apply to values of that type:
`{
maxLength: 2 }` accepts numbers, and
`oneOf: [{ required: ["email"] }, {
required: ["phone"] }]` checks objects only.
A schema without any of these keywords accepts any value, `true` accepts and
`false` rejects every value. `enum`, `const` and `uniqueItems` compare values
deeply (`0` and `-0` are the same number). `minLength`/`maxLength` count code
points, as JSON Schema does (an emoji is 1). `multipleOf` allows for floating
point (`19.99` is a multiple of `0.01`). `pattern` is a Unicode regular
expression (`u` flag). Checked formats are `email`, `uri`, `uuid`, `date`,
`date-time`, `ipv4` and `ipv6`; other formats are accepted as they are. `oneOf`
reports `oneOf` when more than one schema matches and `union` when none does.

JSON Schema semantics apply inside it: only `undefined` (a missing key) is
missing, `""` and `null` are values; a missing required property reports one
`required` issue; properties are optional unless listed in `required`;
additional properties are kept unless `additionalProperties` is `false` (the
keys are reported) or a schema (the keys are validated with it, and their
output, with defaults, is kept). An `object` is a plain JSON object, not a `Map`
or a class instance. With `useDefaults`, defaults are filled in everywhere, also
in `allOf` parts, `$ref` siblings, `prefixItems` and `additionalProperties`.

## References and OpenAPI documents

`$ref` supports local references (`#/$defs/...`, `#/definitions/...`,
`#/components/schemas/...`), including recursive schemas. To validate with a
schema from a larger document, such as an OpenAPI spec, pass the document as
`root`:

```ts
const order = xoe.jsonSchema(spec.components.schemas.Order, {
  root: spec,
  useDefaults: true, // fill in missing properties that have a default
});
```

An unknown or empty `type`, an empty `anyOf`/`oneOf`/`allOf`, an invalid
`pattern`, a keyword with the wrong kind of value (e.g. `enum` that isn't a
list) and a `$ref` that can't be resolved or isn't a JSON pointer (anchors such
as `"#node"`) throw `XOEUsageError` `INVALID_SCHEMA` when the validator is
built.

Only build validators from schemas you trust (your own, your API's). A schema's
`pattern` becomes a regular expression, and a crafted one can take very long on
some inputs (ReDoS).

## Types

The output type comes from the schema when it's written as a literal, inline or
`as const`, with the same rules: optional properties unless `required`,
`enum`/`const` as literal types, `prefixItems` as tuples, `$ref`s resolved (also
into `root`), `nullable` as `| null`, `anyOf`/`oneOf` as unions, `allOf` as an
intersection, and an index signature for kept additional properties:

```ts
const spec = { components: { schemas: { Order: { ... } } } } as const;

const order = xoe.jsonSchema(spec.components.schemas.Order, {
  root: spec,
  useDefaults: true,
});
type Order = Infer<typeof order>; // { items: { sku: string; qty: number }[]; ... }
type OrderInput = InferInput<typeof order>; // properties with a default are optional
```

`FromJsonSchema<typeof schema>` gives the same type without a validator. Schemas
not known at compile time (a `JsonSchema` variable, a JSON import) and recursive
`$ref`s give `unknown`; pass the type for them: `xoe.jsonSchema<User>(schema)`.
