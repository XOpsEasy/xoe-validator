import { expect, test } from "vitest";
import Ajv from "ajv/dist/2020.js";
import withFormats from "ajv-formats";
import xoe, { toJsonSchema, Validator, XOEUsageError } from "../../../index.ts";

const DRAFT = "https://json-schema.org/draft/2020-12/schema";

const ajv = new Ajv({ strict: true, allowUnionTypes: true });
withFormats(ajv);

test("toJsonSchema - an object schema", () => {
  const createUser = xoe
    .object({
      email: xoe.string().email(),
      age: xoe.number().integer().minimum(18),
      role: xoe.enum(["admin", "user"]).default("user"),
      nickname: xoe.string().minLength(2).nullable().optional(),
      tags: xoe.array(xoe.string()).nonEmpty().maxLength(5),
    })
    .strict();

  expect(toJsonSchema(createUser)).toStrictEqual({
    $schema: DRAFT,
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      age: { type: "integer", minimum: 18 },
      role: { enum: ["admin", "user"], default: "user" },
      nickname: { type: ["string", "null"], minLength: 2 },
      tags: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 5,
      },
    },
    required: ["email", "age", "tags"],
    additionalProperties: false,
  });
});

test("toJsonSchema - rules", () => {
  const schema = (validator: Validator<unknown>) => {
    const { $schema: _, ...rest } = toJsonSchema(validator);
    return rest;
  };

  expect(
    schema(xoe.string().length(4).startsWith("RS").endsWith(".x")),
  ).toStrictEqual({
    type: "string",
    minLength: 4,
    maxLength: 4,
    allOf: [{ pattern: "^RS" }, { pattern: "\\.x$" }],
  });
  expect(
    schema(
      xoe
        .string()
        .regexMatch(/^[a-z]+$/)
        .url(),
    ),
  ).toStrictEqual({
    type: "string",
    pattern: "^[a-z]+$",
    format: "uri",
  });
  // RegExp flags have no JSON Schema equivalent, so the pattern is left out.
  expect(schema(xoe.string().regexMatch(/abc/i).uuid())).toStrictEqual({
    type: "string",
    format: "uuid",
  });
  expect(
    schema(xoe.number().positive().negative().divisibleBy(5)),
  ).toStrictEqual({
    type: "number",
    exclusiveMinimum: 0,
    exclusiveMaximum: 0,
    multipleOf: 5,
  });
  expect(schema(xoe.number().between(1, 10))).toStrictEqual({
    type: "number",
    minimum: 1,
    maximum: 10,
  });
  expect(schema(xoe.boolean().isTrue())).toStrictEqual({
    type: "boolean",
    const: true,
  });
  expect(schema(xoe.date())).toStrictEqual({
    type: "string",
    format: "date-time",
  });
  expect(schema(xoe.file().maxSize(10))).toStrictEqual({
    type: "string",
    format: "binary",
  });
  expect(schema(xoe.array().unique())).toStrictEqual({
    type: "array",
    uniqueItems: true,
  });
  expect(schema(xoe.unknown())).toStrictEqual({});
  expect(schema(xoe.literal("admin"))).toStrictEqual({ const: "admin" });
});

test("toJsonSchema - unions, tuples and records", () => {
  const schema = (validator: Validator<unknown>) => {
    const { $schema: _, ...rest } = toJsonSchema(validator);
    return rest;
  };

  expect(schema(xoe.union([xoe.string(), xoe.number()]))).toStrictEqual({
    anyOf: [{ type: "string" }, { type: "number" }],
  });
  expect(
    schema(
      xoe.discriminatedUnion("method", {
        card: xoe.object({ cvc: xoe.string() }),
        cash: xoe.object({}),
      }),
    ),
  ).toStrictEqual({
    oneOf: [
      {
        type: "object",
        properties: { method: { const: "card" }, cvc: { type: "string" } },
        required: ["method", "cvc"],
      },
      {
        type: "object",
        properties: { method: { const: "cash" } },
        required: ["method"],
      },
    ],
  });
  expect(
    schema(xoe.tuple([xoe.number(), xoe.string().optional()])),
  ).toStrictEqual({
    type: "array",
    prefixItems: [{ type: "number" }, { type: "string" }],
    items: false,
    minItems: 1,
  });
  expect(
    schema(xoe.record(xoe.enum(["eur", "usd"]), xoe.number().positive())),
  ).toStrictEqual({
    type: "object",
    propertyNames: { enum: ["eur", "usd"] },
    additionalProperties: { type: "number", exclusiveMinimum: 0 },
  });
});

test("toJsonSchema - recursive schemas use $defs", () => {
  type Category = { name: string; children: Category[] };
  const category: Validator<Category> = xoe.object({
    name: xoe.string(),
    children: xoe.array(xoe.lazy(() => category)),
  });

  const schema = toJsonSchema(xoe.object({ root: xoe.lazy(() => category) }));
  expect(schema).toStrictEqual({
    $schema: DRAFT,
    type: "object",
    properties: { root: { $ref: "#/$defs/Schema1" } },
    required: ["root"],
    $defs: {
      Schema1: {
        type: "object",
        properties: {
          name: { type: "string" },
          children: { type: "array", items: { $ref: "#/$defs/Schema1" } },
        },
        required: ["name", "children"],
      },
    },
  });
  expect(
    ajv.validate(schema, {
      root: { name: "a", children: [{ name: "b", children: [] }] },
    }),
  ).toStrictEqual(true);
  expect(
    ajv.validate(schema, {
      root: { name: "a", children: [{ name: 1, children: [] }] },
    }),
  ).toStrictEqual(false);

  // A lazy validator that doesn't refer to itself is inlined.
  expect(toJsonSchema(xoe.lazy(() => xoe.string()))).toStrictEqual({
    $schema: DRAFT,
    type: "string",
  });
});

test("toJsonSchema - OpenAPI 3.0", () => {
  const schema = toJsonSchema(
    xoe.object({
      note: xoe.string().nullable(),
      price: xoe.number().positive(),
      kind: xoe.literal("item"),
      point: xoe.tuple([xoe.number(), xoe.number()]),
    }),
    { target: "openapi-3.0" },
  );

  expect(schema).toStrictEqual({
    type: "object",
    properties: {
      note: { type: "string", nullable: true },
      price: { type: "number", minimum: 0, exclusiveMinimum: true },
      kind: { enum: ["item"] },
      point: {
        type: "array",
        items: { anyOf: [{ type: "number" }, { type: "number" }] },
        minItems: 2,
        maxItems: 2,
      },
    },
    required: ["note", "price", "kind", "point"],
  });
});

test("toJsonSchema - what can't be described", () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      return error instanceof XOEUsageError ? error.code : "other";
    }
    return "no error";
  };

  expect(code(() => toJsonSchema(xoe.instanceOf(URL)))).toStrictEqual(
    "UNREPRESENTABLE",
  );
  expect(
    toJsonSchema(xoe.object({ link: xoe.instanceOf(URL) }), {
      unrepresentable: "any",
    }),
  ).toStrictEqual({
    $schema: DRAFT,
    type: "object",
    properties: { link: {} },
    required: ["link"],
  });

  type Node = { children: Node[] };
  const node: Validator<Node> = xoe.object({
    children: xoe.array(xoe.lazy(() => node)),
  });
  expect(
    code(() =>
      toJsonSchema(
        xoe.lazy(() => node),
        { target: "openapi-3.0" },
      ),
    ),
  ).toStrictEqual("UNREPRESENTABLE");

  // refine has no equivalent: the schema is less strict than the validator.
  expect(
    toJsonSchema(xoe.number().refine((n) => n % 2 === 0, "Must be even")),
  ).toStrictEqual({ $schema: DRAFT, type: "number" });
  // transform and pipe describe the input.
  expect(
    toJsonSchema(
      xoe
        .string()
        .trim()
        .transform((v) => v.length),
    ),
  ).toStrictEqual({ $schema: DRAFT, type: "string" });
});

test("toJsonSchema - agrees with Ajv on accepted and rejected values", () => {
  const cases: [Validator<unknown>, unknown[]][] = [
    [
      xoe
        .object({
          email: xoe.string().email(),
          age: xoe.number().integer().between(18, 99),
          role: xoe.enum(["admin", "user"]).optional(),
          tags: xoe.array(xoe.string().minLength(1)).maxLength(2).optional(),
        })
        .strict(),
      [
        { email: "a@b.io", age: 30 },
        { email: "a@b.io", age: 30, role: "admin", tags: ["x"] },
        { email: "nope", age: 30 },
        { email: "a@b.io", age: 17 },
        { email: "a@b.io", age: 30.5 },
        { email: "a@b.io", age: 30, role: "root" },
        { email: "a@b.io", age: 30, tags: ["a", "b", "c"] },
        { email: "a@b.io", age: 30, extra: true },
        { age: 30 },
        "not an object",
      ],
    ],
    [
      xoe.discriminatedUnion("type", {
        circle: xoe.object({ radius: xoe.number().positive() }),
        square: xoe.object({ side: xoe.number().positive() }),
      }),
      [
        { type: "circle", radius: 1 },
        { type: "square", side: 2 },
        { type: "circle", radius: -1 },
        { type: "triangle" },
        { radius: 1 },
      ],
    ],
    [
      xoe.tuple([xoe.string(), xoe.number().nullable()]),
      [["a", 1], ["a", null], ["a"], ["a", 1, 2], [1, 1]],
    ],
    [
      xoe.record(xoe.enum(["eur", "usd"]), xoe.number().nonNegative()),
      [{ eur: 1 }, { eur: 1, usd: 0 }, { rsd: 1 }, { eur: -1 }],
    ],
    [
      xoe
        .string()
        .startsWith("RS")
        .length(5)
        .regexMatch(/^[A-Z0-9]+$/),
      ["RS123", "RS12", "XX123", "RSabc"],
    ],
  ];

  for (const [validator, samples] of cases) {
    const schema = toJsonSchema(validator);
    for (const sample of samples) {
      expect(
        ajv.validate(schema, sample),
        JSON.stringify(sample),
      ).toStrictEqual(
        validator.validate(sample, { emptyValues: "undefined" }).type ===
          "success",
      );
    }
  }
});

test("toJsonSchema - round trip with xoe.jsonSchema", () => {
  const original = {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "integer", minimum: 1 },
      name: { type: ["string", "null"], minLength: 2 },
      tags: { type: "array", items: { type: "string" } },
    },
    additionalProperties: false,
  } as const;

  const { $schema: _, ...described } = toJsonSchema(xoe.jsonSchema(original));
  expect(described).toStrictEqual({
    type: "object",
    properties: {
      id: { type: "integer", minimum: 1 },
      name: { anyOf: [{ type: "string", minLength: 2 }, { type: "null" }] },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["id"],
    additionalProperties: false,
  });
});

test("toJsonSchema - the added rules, meta and catchall", () => {
  const schema = (validator: Validator<unknown>, options = {}) => {
    const { $schema: _, ...rest } = toJsonSchema(validator, options);
    return rest;
  };

  expect(schema(xoe.string().date())).toStrictEqual({
    type: "string",
    format: "date",
  });
  expect(schema(xoe.string().dateTime())).toStrictEqual({
    type: "string",
    format: "date-time",
  });
  // date-time requires an offset, so local date-times have no format.
  expect(schema(xoe.string().dateTime({ local: true }))).toStrictEqual({
    type: "string",
  });
  expect(schema(xoe.string().ip(6))).toStrictEqual({
    type: "string",
    format: "ipv6",
  });
  expect(schema(xoe.string().ip())).toStrictEqual({
    type: "string",
    anyOf: [{ format: "ipv4" }, { format: "ipv6" }],
  });
  expect(schema(xoe.string().digits())).toStrictEqual({
    type: "string",
    pattern: "^[0-9]+$",
  });
  expect(schema(xoe.number().greaterThan(0).lessThan(10))).toStrictEqual({
    type: "number",
    exclusiveMinimum: 0,
    exclusiveMaximum: 10,
  });
  expect(schema(xoe.number().maxDecimals(2))).toStrictEqual({
    type: "number",
    multipleOf: 0.01,
  });
  expect(schema(xoe.number().safeInteger())).toStrictEqual({
    type: "integer",
    minimum: Number.MIN_SAFE_INTEGER,
    maximum: Number.MAX_SAFE_INTEGER,
  });
  expect(schema(xoe.array().length(3))).toStrictEqual({
    type: "array",
    minItems: 3,
    maxItems: 3,
  });

  const settings = xoe
    .object({ theme: xoe.string() })
    .catchall(xoe.number())
    .describe("User settings");
  expect(schema(settings)).toStrictEqual({
    type: "object",
    properties: { theme: { type: "string" } },
    required: ["theme"],
    additionalProperties: { type: "number" },
    description: "User settings",
  });

  const age = xoe.number().meta({
    title: "Age",
    description: "In years",
    examples: [30, 42],
    deprecated: true,
  });
  expect(schema(age)).toStrictEqual({
    type: "number",
    title: "Age",
    description: "In years",
    examples: [30, 42],
    deprecated: true,
  });
  // OpenAPI 3.0 has one example.
  expect(toJsonSchema(age, { target: "openapi-3.0" })).toStrictEqual({
    type: "number",
    title: "Age",
    description: "In years",
    example: 30,
    deprecated: true,
  });
});

test("toJsonSchema - the added rules agree with Ajv", () => {
  const cases: [Validator<unknown>, unknown[]][] = [
    [xoe.string().date(), ["2024-02-29", "2023-02-29", "2024-1-1"]],
    [
      xoe.string().dateTime(),
      ["2024-05-01T10:00:00Z", "2024-05-01T10:00:00+02:00", "2024-05-01"],
    ],
    [xoe.string().ip(), ["10.0.0.1", "::1", "300.1.1.1", "x"]],
    [xoe.string().ip(4), ["10.0.0.1", "::1"]],
    [xoe.string().digits(), ["123", "12a", "-1"]],
    [xoe.number().greaterThan(0).lessThan(1), [0, 0.5, 1]],
    [xoe.number().safeInteger(), [1, 2 ** 53, 1.5]],
    [xoe.array().length(2), [[1, 2], [1], [1, 2, 3]]],
    [
      xoe.object({ a: xoe.string() }).catchall(xoe.number()),
      [{ a: "x", b: 1 }, { a: "x", b: "y" }, { a: 1 }],
    ],
  ];
  for (const [validator, samples] of cases) {
    const schema = toJsonSchema(validator);
    for (const sample of samples) {
      expect(
        ajv.validate(schema, sample),
        `${JSON.stringify(schema)} ${JSON.stringify(sample)}`,
      ).toStrictEqual(
        validator.validate(sample, { emptyValues: "undefined" }).type ===
          "success",
      );
    }
  }
});
