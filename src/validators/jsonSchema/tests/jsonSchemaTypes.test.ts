import { expect, test } from "vitest";
import xoe, {
  FromJsonSchema,
  Infer,
  InferInput,
  JsonSchema,
  Validator,
} from "../../../index.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
// oxlint-disable-next-line no-unused-vars -- the type argument is the assertion
const expectType = <T extends true>() => {};

// Type-only checks: this function is type checked, not called.
const _typeTests = () => {
  // An inline schema: properties are optional unless required, additional
  // properties are kept.
  const user = xoe.jsonSchema({
    type: "object",
    required: ["id", "email"],
    properties: {
      id: { type: "integer", minimum: 1 },
      email: { type: "string", format: "email" },
      role: { enum: ["admin", "user"] },
      nickname: { type: ["string", "null"] },
      tags: { type: "array", items: { type: "string" } },
    },
  });
  expectType<
    Equal<
      Infer<typeof user>,
      {
        id: number;
        email: string;
        role?: "admin" | "user";
        nickname?: string | null;
        tags?: string[];
        [key: string]: unknown;
      }
    >
  >();

  // additionalProperties: false gives an exact object.
  const point = {
    type: "object",
    required: ["x", "y"],
    properties: { x: { type: "number" }, y: { type: "number" } },
    additionalProperties: false,
  } as const;
  const pointValidator = xoe.jsonSchema(point);
  expectType<Equal<Infer<typeof pointValidator>, { x: number; y: number }>>();
  expectType<Equal<FromJsonSchema<typeof point>, { x: number; y: number }>>();

  // Keywords that only check values keep the type; enum and const narrow it.
  expectType<Equal<FromJsonSchema<{ type: "string"; minLength: 2 }>, string>>();
  expectType<
    Equal<FromJsonSchema<{ type: "string"; enum: ["a", "b", 1] }>, "a" | "b">
  >();
  expectType<Equal<FromJsonSchema<{ const: 42 }>, 42>>();
  expectType<
    Equal<FromJsonSchema<{ type: "integer"; nullable: true }>, number | null>
  >();
  expectType<Equal<FromJsonSchema<{ type: "boolean" }>, boolean>>();
  expectType<Equal<FromJsonSchema<{ type: "null" }>, null>>();

  // true, false and an empty schema.
  expectType<Equal<FromJsonSchema<true>, unknown>>();
  expectType<Equal<FromJsonSchema<false>, never>>();
  // oxlint-disable-next-line typescript/no-empty-object-type
  expectType<Equal<FromJsonSchema<{}>, unknown>>(); // the empty schema

  // Combinators.
  expectType<
    Equal<
      FromJsonSchema<{ anyOf: [{ type: "string" }, { type: "number" }] }>,
      string | number
    >
  >();
  expectType<
    Equal<
      FromJsonSchema<{ oneOf: [{ const: "a" }, { type: "null" }] }>,
      "a" | null
    >
  >();
  expectType<
    Equal<
      FromJsonSchema<{
        allOf: [
          {
            type: "object";
            required: ["a"];
            properties: { a: { type: "string" } };
          },
          {
            type: "object";
            required: ["b"];
            properties: { b: { type: "number" } };
          },
        ];
      }>,
      { a: string; [key: string]: unknown } & {
        b: number;
        [key: string]: unknown;
      }
    >
  >();

  // Arrays and tuples.
  expectType<Equal<FromJsonSchema<{ type: "array" }>, unknown[]>>();
  expectType<
    Equal<
      FromJsonSchema<{
        type: "array";
        prefixItems: [{ type: "string" }, { type: "number" }];
        items: false;
        minItems: 1;
      }>,
      [string, number?]
    >
  >();
  expectType<
    Equal<
      FromJsonSchema<{
        type: "array";
        prefixItems: [{ type: "string" }];
        items: { type: "boolean" };
      }>,
      [string?, ...boolean[]]
    >
  >();

  // $ref into $defs, and into an OpenAPI document with { root }.
  const withDefs = xoe.jsonSchema({
    type: "object",
    required: ["home"],
    properties: { home: { $ref: "#/$defs/Address" } },
    additionalProperties: false,
    $defs: {
      Address: {
        type: "object",
        required: ["city"],
        properties: { city: { type: "string" } },
        additionalProperties: false,
      },
    },
  });
  expectType<Equal<Infer<typeof withDefs>, { home: { city: string } }>>();

  const spec = {
    components: {
      schemas: {
        Item: {
          type: "object",
          required: ["sku"],
          properties: {
            sku: { type: "string" },
            qty: { type: "integer", default: 1 },
          },
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
            status: { enum: ["new", "paid"], default: "new" },
          },
          additionalProperties: false,
        },
      },
    },
  } as const;
  const order = xoe.jsonSchema(spec.components.schemas.Order, {
    root: spec,
    useDefaults: true,
  });
  // With useDefaults, properties with a default are always in the output.
  expectType<
    Equal<
      Infer<typeof order>,
      {
        items: { sku: string; qty: number }[];
        status: "new" | "paid";
      }
    >
  >();
  expectType<
    Equal<
      InferInput<typeof order>,
      {
        items: { sku: string; qty?: number }[];
        status?: "new" | "paid";
      }
    >
  >();
  // Without it, they stay optional.
  const plainOrder = xoe.jsonSchema(spec.components.schemas.Order, {
    root: spec,
  });
  expectType<
    Equal<
      Infer<typeof plainOrder>,
      {
        items: { sku: string; qty?: number }[];
        status?: "new" | "paid";
      }
    >
  >();

  // A recursive $ref stops at unknown.
  const tree = xoe.jsonSchema({
    $ref: "#/$defs/Node",
    $defs: {
      Node: {
        type: "object",
        required: ["children"],
        properties: {
          children: { type: "array", items: { $ref: "#/$defs/Node" } },
        },
        additionalProperties: false,
      },
    },
  });
  expectType<Equal<Infer<typeof tree>, { children: unknown[] }>>();

  // Schemas not known at compile time give unknown; pass a type for them.
  const loaded: JsonSchema = { type: "string" };
  type User = { id: number };
  const typed = xoe.jsonSchema<User>(loaded);
  expectType<Equal<typeof typed, Validator<User, User, false>>>();
  const wide = xoe.jsonSchema(loaded);
  expectType<Equal<Infer<typeof wide>, unknown>>();

  // Inferred validators compose with the rest of xoe.
  const form = xoe.object({ user, note: xoe.string().optional() });
  expectType<Equal<Infer<typeof form>["user"]["id"], number>>();
};

test("jsonSchema types - the inferred type matches the output", () => {
  const user = xoe.jsonSchema(
    {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "integer" },
        role: { enum: ["admin", "user"], default: "user" },
      },
    },
    { useDefaults: true },
  );

  const result = user.validate({ id: 1, extra: true });
  expect(result.type).toStrictEqual("success");
  if (result.type === "success") {
    // No casts: id, role and extra are typed from the schema.
    const id: number = result.value.id;
    const role: "admin" | "user" = result.value.role;
    expect([id, role, result.value.extra]).toStrictEqual([1, "user", true]);
  }
});
