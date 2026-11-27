// Type checks against the packed type declarations (tsc --noEmit).
import xoe, {
  type FromJsonSchema,
  type Infer,
  type InferInput,
  type IsAsync,
  type Validator,
} from "@x-ops-easy/xoe-validator";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
// oxlint-disable-next-line no-unused-vars -- the type argument is the assertion
const expectType = <T extends true>() => {};

const user = xoe.object({
  name: xoe.string().trim(),
  age: xoe.coerce.number().optional(),
  role: xoe.enum(["admin", "user"]).default("user"),
  tags: xoe.array(xoe.string()),
  pair: xoe.tuple([xoe.string(), xoe.number().nullable()]),
  kind: xoe.discriminatedUnion("type", { a: xoe.object({ x: xoe.number() }) }),
});
expectType<
  Equal<
    Infer<typeof user>,
    {
      name: string;
      age?: number | null | undefined;
      role: "admin" | "user";
      tags: string[];
      pair: [string, number | null];
      kind: { type: "a"; x: number };
    }
  >
>();
expectType<
  Equal<InferInput<typeof user>["age"], string | number | null | undefined>
>();
expectType<Equal<IsAsync<typeof user>, false>>();

// Async validators can't use validate().
const taken = xoe.string().refineAsync(() => Promise.resolve(true));
expectType<Equal<IsAsync<typeof taken>, true>>();
// @ts-expect-error validate() is a type error for async validators
taken.validate("x");

// transform changes the output, not the input.
const length = xoe.string().transform((text) => text.length);
expectType<Equal<Infer<typeof length>, number>>();
expectType<Equal<InferInput<typeof length>, string>>();

// Types inferred from a literal JSON Schema, with $ref into a root document.
const spec = {
  components: {
    schemas: {
      Item: {
        type: "object",
        required: ["sku"],
        properties: { sku: { type: "string" } },
        additionalProperties: false,
      },
      Order: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Item" },
          },
        },
        additionalProperties: false,
      },
    },
  },
} as const;
const order = xoe.jsonSchema(spec.components.schemas.Order, { root: spec });
expectType<Equal<Infer<typeof order>, { items: { sku: string }[] }>>();
expectType<
  Equal<FromJsonSchema<{ type: "string"; enum: ["a", "b"] }>, "a" | "b">
>();

// Recursive schemas with an explicit type.
type Category = { name: string; children: Category[] };
const category: Validator<Category> = xoe.object({
  name: xoe.string(),
  children: xoe.array(xoe.lazy(() => category)),
});
// oxlint-disable-next-line typescript/no-meaningless-void-operator -- marks the schema as used
void category;
