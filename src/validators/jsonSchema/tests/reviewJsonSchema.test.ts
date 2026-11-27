// Regression tests for the November 2026 code review findings on
// xoe.jsonSchema (V19-V25) and toJsonSchema (V26-V33).
import { expect, test } from "vitest";
import Ajv from "ajv/dist/2020.js";
import xoe, {
  JsonSchemaObject,
  toJsonSchema,
  Validator,
  XOEUsageError,
  XOEValidationOutput,
} from "../../../index.ts";
import { expectedSuccess } from "../../../core/tests/helpers.ts";

const codes = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error"
    ? result.value.map((issue) => `${issue.path.join(".")}:${issue.code}`)
    : [];

const usageCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof XOEUsageError ? error.code : String(error);
  }
  return "no error";
};

const timed = <T>(fn: () => T): [T, number] => {
  const start = performance.now();
  const value = fn();
  return [value, performance.now() - start];
};

test("V19 - oneOf with required-only branches works", () => {
  const contact = xoe.jsonSchema({
    type: "object",
    properties: { email: { type: "string" }, phone: { type: "string" } },
    oneOf: [{ required: ["email"] }, { required: ["phone"] }],
  });

  expect(contact.validate({ email: "a@b.c" }).type).toStrictEqual("success");
  expect(contact.validate({ phone: "1" }).type).toStrictEqual("success");
  expect(codes(contact.validate({}))).toStrictEqual([":union"]);
  expect(codes(contact.validate({ email: "a", phone: "b" }))).toStrictEqual([
    ":oneOf",
  ]);
});

test("V19 - keywords without type apply to values of their type", () => {
  const short = xoe.jsonSchema({ maxLength: 2 });
  expect(codes(short.validate("abc"))).toStrictEqual([":string.maxLength"]);
  expect(short.validate(12345).type).toStrictEqual("success");

  const evenOrTriple = xoe.jsonSchema({
    type: "number",
    oneOf: [{ multipleOf: 2 }, { multipleOf: 3 }],
  });
  expect(evenOrTriple.validate(4).type).toStrictEqual("success");
  expect(evenOrTriple.validate(9).type).toStrictEqual("success");
  expect(codes(evenOrTriple.validate(6))).toStrictEqual([":oneOf"]);

  const kind = xoe.jsonSchema({
    type: "object",
    oneOf: [
      { properties: { kind: { const: "a" } } },
      { properties: { kind: { const: "b" } } },
    ],
  });
  expect(kind.validate({ kind: "a" }).type).toStrictEqual("success");
  expect(codes(kind.validate({ kind: "c" }))).toStrictEqual([":union"]);
  // A required key without type still requires a value.
  expect(codes(xoe.jsonSchema({ required: ["a"] }).validate({}))).toStrictEqual(
    ["a:required"],
  );
  expect(xoe.jsonSchema({ required: ["a"] }).validate("x").type).toStrictEqual(
    "success",
  );
});

test("V20 - allOf and $ref siblings fill in every default", () => {
  const spec = {
    components: {
      schemas: {
        Base: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "integer" },
            kind: { type: "string", default: "base" },
          },
        },
        Order: {
          allOf: [
            { $ref: "#/components/schemas/Base" },
            {
              type: "object",
              properties: { status: { type: "string", default: "new" } },
            },
          ],
        },
      },
    },
  } as const;
  const order = xoe.jsonSchema(spec.components.schemas.Order, {
    root: spec,
    useDefaults: true,
  });
  expect(order.validate({ id: 1 })).toStrictEqual(
    expectedSuccess({ id: 1, kind: "base", status: "new" }),
  );

  const siblings = xoe.jsonSchema(
    {
      $defs: { Base: spec.components.schemas.Base },
      $ref: "#/$defs/Base",
      type: "object",
      properties: { status: { type: "string", default: "new" } },
    },
    { useDefaults: true },
  );
  expect(siblings.validate({ id: 1 })).toStrictEqual(
    expectedSuccess({ id: 1, kind: "base", status: "new" }),
  );
});

test("V21 - additionalProperties schemas report issues and keep outputs", () => {
  const prices = xoe.jsonSchema({
    type: "object",
    properties: { currency: { type: "string" } },
    additionalProperties: { type: "number", minimum: 0 },
  });
  expect(codes(prices.validate({ currency: 5, a: -1 }))).toStrictEqual([
    "currency:type",
    "a:number.minimum",
  ]);
  expect(prices.validate({ currency: "EUR", a: 1 })).toStrictEqual(
    expectedSuccess({ currency: "EUR", a: 1 }),
  );
  expect(toJsonSchema(prices).additionalProperties).toStrictEqual({
    type: "number",
    minimum: 0,
  });

  const extra = xoe.jsonSchema(
    {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: { n: { type: "number", default: 1 } },
      },
    },
    { useDefaults: true },
  );
  expect(extra.validate({ k: {} })).toStrictEqual(
    expectedSuccess({ k: { n: 1 } }),
  );
});

test("V21 - prefixItems and items fill in defaults", () => {
  const pair = xoe.jsonSchema(
    {
      type: "array",
      prefixItems: [
        {
          type: "object",
          properties: { n: { type: "number", default: 1 } },
        },
      ],
      items: {
        type: "object",
        properties: { m: { type: "number", default: 2 } },
      },
    },
    { useDefaults: true },
  );

  expect(pair.validate([{}, {}])).toStrictEqual(
    expectedSuccess([{ n: 1 }, { m: 2 }]),
  );
  expect(pair.validate([])).toStrictEqual(expectedSuccess([]));
  expect(codes(pair.validate([1, "x"]))).toStrictEqual(["0:type", "1:type"]);
  expect(
    codes(
      xoe
        .jsonSchema({
          type: "array",
          prefixItems: [{ type: "string" }],
          items: false,
        })
        .validate(["a", 1]),
    ),
  ).toStrictEqual(["1:jsonSchema.false"]);
});

test("V22 - uniqueItems compares deeply in linear time", () => {
  const unique = xoe.jsonSchema({ type: "array", uniqueItems: true });

  expect(unique.validate([1, 2, 1]).type).toStrictEqual("error");
  expect(
    unique.validate([
      { a: 1, b: 2 },
      { b: 2, a: 1 },
    ]).type,
  ).toStrictEqual("error");
  expect(unique.validate([{ a: 1 }, { a: 2 }]).type).toStrictEqual("success");
  expect(unique.validate([[1], [1]]).type).toStrictEqual("error");
  expect(unique.validate(["1", 1]).type).toStrictEqual("success");
  expect(unique.validate([0, -0]).type).toStrictEqual("error");
  expect(
    unique.validate([{ a: [1, { b: null }] }, { a: [1, { b: 0 }] }]).type,
  ).toStrictEqual("success");

  const [, intMs] = timed(() =>
    unique.validate(Array.from({ length: 20_000 }, (_, i) => i)),
  );
  expect(intMs < 300, `${Math.round(intMs)} ms`).toStrictEqual(true);
  const [, objectMs] = timed(() =>
    unique.validate(Array.from({ length: 5_000 }, (_, i) => ({ i }))),
  );
  expect(objectMs < 300, `${Math.round(objectMs)} ms`).toStrictEqual(true);
});

test("V23 - invalid schemas throw INVALID_SCHEMA when built", () => {
  const invalid: unknown[] = [
    { type: "object", properties: { child: { $ref: "#node" } } },
    { $ref: 5 },
    { $ref: "#/$defs/%E0%A4%A" },
    { type: "object", required: 5 },
    { type: "object", properties: 5 },
    { anyOf: {} },
    { type: "array", prefixItems: {} },
    { enum: "abc" },
  ];
  for (const schema of invalid) {
    expect(
      usageCode(() => xoe.jsonSchema(schema as never)),
      JSON.stringify(schema),
    ).toStrictEqual("INVALID_SCHEMA");
  }
});

test("V24 - jsonSchema string lengths count code points", () => {
  const twoEmoji = "\u{1F4A9}\u{1F4A9}";
  expect(
    xoe.jsonSchema({ type: "string", maxLength: 2 }).validate(twoEmoji).type,
  ).toStrictEqual("success");
  expect(
    codes(
      xoe.jsonSchema({ type: "string", minLength: 2 }).validate("\u{1F4A9}"),
    ),
  ).toStrictEqual([":string.minLength"]);
});

test("V25 - a missing property reports one required issue", () => {
  const schema = xoe.jsonSchema({
    type: "object",
    required: ["role", "v", "ref"],
    properties: {
      role: { type: "string", enum: ["a", "b"] },
      v: { oneOf: [{ type: "string" }, { type: "number" }] },
      ref: { allOf: [{ type: "string" }, { minLength: 1 }] },
    },
  });

  expect(codes(schema.validate({}))).toStrictEqual([
    "role:required",
    "v:required",
    "ref:required",
  ]);
});

test("V26 - refine with a built-in code doesn't break toJsonSchema", () => {
  const contact = xoe
    .object({
      email: xoe.string().optional(),
      phone: xoe.string().optional(),
    })
    .refine((value) => Boolean(value.email || value.phone), {
      code: "object.requireOne",
      message: "Give an email or a phone number",
    });

  expect(toJsonSchema(contact).anyOf).toStrictEqual(undefined);
  expect(
    toJsonSchema(xoe.string().refine(() => true, { code: "enum" })).enum,
  ).toStrictEqual(undefined);
  expect(
    toJsonSchema(
      xoe
        .number()
        .minimum(5)
        .refine(() => true, { code: "number.minimum" }),
    ).minimum,
  ).toStrictEqual(5);
  expect(
    toJsonSchema(xoe.number().refine(() => true, { code: "number.integer" }))
      .type,
  ).toStrictEqual("number");
});

test("V28 - nullable enums, literals and unions accept null", () => {
  const ajv = new Ajv({ strict: false, allowUnionTypes: true });
  const check = (schema: JsonSchemaObject, value: unknown) =>
    ajv.validate(schema, value);

  const isTrue = toJsonSchema(xoe.boolean().isTrue().nullable());
  expect(check(isTrue, null)).toStrictEqual(true);
  expect(check(isTrue, true)).toStrictEqual(true);
  expect(check(isTrue, false)).toStrictEqual(false);

  for (const validator of [
    xoe.enum(["a", "b"]).nullable(),
    xoe.literal("a").nullable(),
    xoe.union([xoe.string(), xoe.number()]).nullable(),
    xoe.boolean().isTrue().nullable(),
  ] as Validator<unknown>[]) {
    const schema = toJsonSchema(validator, { target: "openapi-3.0" });
    expect(check(schema, null), JSON.stringify(schema)).toStrictEqual(true);
  }
});

test("V29 - OpenAPI 3.0 bounds keep only the tightest one", () => {
  const openapi = (validator: Validator<unknown>) =>
    toJsonSchema(validator, { target: "openapi-3.0" });

  expect(openapi(xoe.number().positive().minimum(1))).toStrictEqual({
    type: "number",
    minimum: 1,
  });
  expect(openapi(xoe.number().lessThan(100).maximum(50))).toStrictEqual({
    type: "number",
    maximum: 50,
  });
  expect(openapi(xoe.number().minimum(1).greaterThan(5))).toStrictEqual({
    type: "number",
    minimum: 5,
    exclusiveMinimum: true,
  });
  expect(
    toJsonSchema(xoe.number().minimum(5).minimum(3)).minimum,
  ).toStrictEqual(5);
});

test("V30 - patterns are exported only when they work with the u flag", () => {
  expect(
    // oxlint-disable-next-line no-useless-escape -- the escape is what the test is about
    toJsonSchema(xoe.string().regexMatch(/^\d{3}\-\d{4}$/)).pattern,
  ).toStrictEqual(undefined);
  expect(
    toJsonSchema(xoe.string().regexMatch(/^\p{Lu}+$/u)).pattern,
  ).toStrictEqual("^\\p{Lu}+$");
  expect(
    toJsonSchema(xoe.string().regexMatch(/^[a-z]+$/)).pattern,
  ).toStrictEqual("^[a-z]+$");
});

test("V31 - the discriminator const wins over a wider key schema", () => {
  const base = xoe.object({ type: xoe.string() });
  const union = xoe.discriminatedUnion("type", {
    card: base.extend({ number: xoe.string().optional() }),
    cash: base,
  });
  const schema = toJsonSchema(union);
  const ajv = new Ajv({ strict: false });

  expect(ajv.validate(schema, { type: "card" })).toStrictEqual(true);
  expect(ajv.validate(schema, { type: "other" })).toStrictEqual(false);
});

test("V32 - toJsonSchema doesn't call default functions", () => {
  let calls = 0;
  const schema = toJsonSchema(
    xoe.object({
      id: xoe.string().default(() => {
        calls++;
        return crypto.randomUUID();
      }),
      role: xoe.string().default("user"),
    }),
  );
  const properties = schema.properties as Record<string, JsonSchemaObject>;

  expect(calls).toStrictEqual(0);
  expect(properties.role.default).toStrictEqual("user");
  expect("default" in properties.id).toStrictEqual(false);
});

test("V33 - OpenAPI 3.0 recursion with unrepresentable any has no $defs", () => {
  type Node = { children: Node[] };
  const node: Validator<Node> = xoe.object({
    children: xoe.array(xoe.lazy(() => node)),
  });
  const schema = toJsonSchema(xoe.object({ root: node }), {
    target: "openapi-3.0",
    unrepresentable: "any",
  });

  expect(JSON.stringify(schema).includes("$ref")).toStrictEqual(false);
  expect("$defs" in schema).toStrictEqual(false);
});

test("S3 - a non-canonical numeric discriminator key stays a string", () => {
  const union = xoe.discriminatedUnion("v", {
    "01": xoe.object({}),
    "2": xoe.object({}),
  });
  const schema = toJsonSchema(union);
  const ajv = new Ajv({ strict: false });

  expect(ajv.validate(schema, { v: 1 })).toStrictEqual(false);
  expect(union.validate({ v: 1 }).type).toStrictEqual("error");
  expect(ajv.validate(schema, { v: 2 })).toStrictEqual(true);
  expect(union.validate({ v: 2 }).type).toStrictEqual("success");
});
