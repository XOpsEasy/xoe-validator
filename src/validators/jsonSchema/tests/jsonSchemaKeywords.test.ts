import { expect, test } from "vitest";
import Ajv from "ajv/dist/2020.js";
import withFormats from "ajv-formats";
import xoe, {
  JsonSchemaDefinition,
  toFieldErrors,
  XOEUsageError,
  XOEValidationOutput,
} from "../../../index.ts";

const ajv = new Ajv({ strict: false, allowUnionTypes: true });
withFormats(ajv);

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const usageCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof XOEUsageError ? error.code : "other";
  }
  return "no error";
};

const accepts = (schema: JsonSchemaDefinition, value: unknown) =>
  xoe.jsonSchema(schema).validate(value).type === "success";

test("jsonSchema - enum and const compare by value, with or without type", () => {
  expect(
    [1, "a", null, { x: 1 }, 2, { x: 2 }].map((v) =>
      accepts({ enum: [1, "a", null, { x: 1 }] }, v),
    ),
  ).toStrictEqual([true, true, true, true, false, false]);
  expect(accepts({ type: "string", enum: ["a", "b"] }, "b")).toStrictEqual(
    true,
  );
  expect(accepts({ type: "string", enum: ["a", "b"] }, "c")).toStrictEqual(
    false,
  );
  expect(accepts({ const: [1, 2] }, [1, 2])).toStrictEqual(true);
  expect(accepts({ const: [1, 2] }, [2, 1])).toStrictEqual(false);
  const wrongVersion = xoe.jsonSchema({ const: "v1" }).validate("v2");
  expect(
    wrongVersion.type === "error" && wrongVersion.value[0].code,
  ).toStrictEqual("literal");
});

test("jsonSchema - pattern and formats", () => {
  expect(accepts({ type: "string", pattern: "^\\p{Lu}" }, "Ana")).toStrictEqual(
    true,
  );
  expect(accepts({ type: "string", pattern: "^\\p{Lu}" }, "ana")).toStrictEqual(
    false,
  );
  expect(
    usageCode(() => xoe.jsonSchema({ type: "string", pattern: "(" })),
  ).toStrictEqual("INVALID_SCHEMA");

  const formats: [string, unknown[], unknown[]][] = [
    ["email", ["a@b.io"], ["a@b"]],
    ["uri", ["https://x.io/a", "mailto:a@b.io"], ["not a uri"]],
    ["uuid", ["00000000-0000-0000-0000-000000000000"], ["123"]],
    ["date", ["2024-02-29"], ["2024-02-30", "2024-2-1"]],
    [
      "date-time",
      ["2024-05-01T10:00:00Z", "2024-05-01T10:00:00.5+02:00"],
      ["2024-05-01", "2024-02-30T10:00:00Z"],
    ],
    ["hostname", ["anything"], []], // other formats are notes
  ];
  for (const [format, valid, invalid] of formats) {
    const schema = { type: "string", format } as const;
    for (const value of valid) {
      expect(accepts(schema, value), `${format} ${value}`).toStrictEqual(true);
    }
    for (const value of invalid) {
      expect(accepts(schema, value), `${format} ${value}`).toStrictEqual(false);
    }
  }
});

test("jsonSchema - numbers", () => {
  const schema = (extra: object) =>
    ({ type: "number", ...extra }) as JsonSchemaDefinition;

  expect(
    [0, 0.1].map((v) => accepts(schema({ exclusiveMinimum: 0 }), v)),
  ).toStrictEqual([false, true]);
  expect(
    [10, 9].map((v) => accepts(schema({ exclusiveMaximum: 10 }), v)),
  ).toStrictEqual([false, true]);
  // OpenAPI 3.0 form.
  expect(
    [0, 1].map((v) =>
      accepts(schema({ minimum: 0, exclusiveMinimum: true }), v),
    ),
  ).toStrictEqual([false, true]);
  expect(
    [10, 15].map((v) => accepts(schema({ multipleOf: 5 }), v)),
  ).toStrictEqual([true, true]);
  expect(accepts(schema({ multipleOf: 5 }), 7)).toStrictEqual(false);
});

test("jsonSchema - arrays", () => {
  const unique = { type: "array", uniqueItems: true } as const;
  expect(accepts(unique, [{ a: 1 }, { a: 2 }])).toStrictEqual(true);
  expect(accepts(unique, [{ a: 1 }, { a: 1 }])).toStrictEqual(false);

  const sized = { type: "array", minItems: 1, maxItems: 2 } as const;
  expect([[], [1], [1, 2, 3]].map((v) => accepts(sized, v))).toStrictEqual([
    false,
    true,
    false,
  ]);

  const tuple = {
    type: "array",
    prefixItems: [{ type: "string" }, { type: "number" }],
    items: false,
  } as const;
  expect(
    [["a"], ["a", 1], ["a", 1, 2], [1]].map((v) => accepts(tuple, v)),
  ).toStrictEqual([true, true, false, false]);

  const withRest = {
    type: "array",
    prefixItems: [{ type: "string" }],
    items: { type: "number" },
  } as const;
  expect(
    fieldErrors(xoe.jsonSchema(withRest).validate(["a", 1, "x"])),
  ).toStrictEqual({
    "2": ["Value must be a number."],
  });
});

test("jsonSchema - objects with additionalProperties schemas", () => {
  const prices = {
    type: "object",
    properties: { currency: { type: "string" } },
    additionalProperties: { type: "number", minimum: 0 },
  } as const;

  expect(accepts(prices, { currency: "eur", a: 1, b: 2 })).toStrictEqual(true);
  expect(
    fieldErrors(xoe.jsonSchema(prices).validate({ currency: "eur", a: -1 })),
  ).toStrictEqual({
    a: ["Must be greater than or equal to 0."],
  });
});

test("jsonSchema - anyOf, oneOf and allOf", () => {
  const id = {
    anyOf: [{ type: "integer" }, { type: "string", format: "uuid" }],
  } as const;
  expect(
    [1, "00000000-0000-0000-0000-000000000000", "x"].map((v) => accepts(id, v)),
  ).toStrictEqual([true, true, false]);

  const exactlyOne = {
    oneOf: [
      { type: "number", multipleOf: 3 },
      {
        type: "number",
        multipleOf: 5,
      },
    ],
  } as const;
  expect([3, 5, 15, 7].map((v) => accepts(exactlyOne, v))).toStrictEqual([
    true,
    true,
    false,
    false,
  ]);
  const both = xoe.jsonSchema(exactlyOne).validate(15);
  expect(both.type === "error" && both.value[0].code).toStrictEqual("oneOf");

  const named = {
    allOf: [
      {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      {
        type: "object",
        properties: { age: { type: "integer" } },
        required: ["age"],
      },
    ],
  } as const;
  expect(accepts(named, { name: "a", age: 1 })).toStrictEqual(true);
  expect(
    fieldErrors(xoe.jsonSchema(named).validate({ name: "a" })),
  ).toStrictEqual({
    age: ["This field is required."],
  });

  expect(usageCode(() => xoe.jsonSchema({ anyOf: [] }))).toStrictEqual(
    "INVALID_SCHEMA",
  );
});

test("jsonSchema - $ref with $defs and recursion", () => {
  const tree = {
    $defs: {
      node: {
        type: "object",
        properties: {
          name: { type: "string" },
          children: { type: "array", items: { $ref: "#/$defs/node" } },
        },
        required: ["name"],
      },
    },
    $ref: "#/$defs/node",
  } as const;

  expect(accepts(tree, { name: "a", children: [{ name: "b" }] })).toStrictEqual(
    true,
  );
  expect(
    fieldErrors(
      xoe.jsonSchema(tree).validate({ name: "a", children: [{ name: 1 }] }),
    ),
  ).toStrictEqual({
    "children.0.name": ["Value must be text."],
  });
  expect(
    usageCode(() => xoe.jsonSchema({ $ref: "#/$defs/missing" })),
  ).toStrictEqual("INVALID_SCHEMA");
  expect(
    usageCode(() =>
      xoe.jsonSchema({ $ref: "https://example.com/schema.json" }),
    ),
  ).toStrictEqual("INVALID_SCHEMA");
});

test("jsonSchema - an OpenAPI 3.0 document", () => {
  const spec = {
    openapi: "3.0.3",
    components: {
      schemas: {
        Address: {
          type: "object",
          properties: {
            city: { type: "string" },
            zip: { type: "string", pattern: "^\\d{5}$" },
          },
          required: ["city"],
        },
        User: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1 },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["admin", "user"], default: "user" },
            nickname: { type: "string", nullable: true },
            address: { $ref: "#/components/schemas/Address" },
          },
          required: ["id", "email"],
        },
      },
    },
  } as const;

  const user = xoe.jsonSchema(spec.components.schemas.User, { root: spec });
  expect(
    user.validate({
      id: 1,
      email: "a@b.io",
      nickname: null,
      address: { city: "NS" },
    }).type,
  ).toStrictEqual("success");
  expect(
    fieldErrors(
      user.validate({ id: 0, email: "x", role: "root", address: { zip: "1" } }),
    ),
  ).toStrictEqual({
    id: ["Must be greater than or equal to 1."],
    email: ["Invalid email address."],
    role: ['Value must be one of: "admin", "user".'],
    "address.city": ["This field is required."],
    "address.zip": ["Invalid format."],
  });

  // default is applied only with useDefaults.
  const withDefaults = xoe.jsonSchema(spec.components.schemas.User, {
    root: spec,
    useDefaults: true,
  });
  expect(withDefaults.validate({ id: 1, email: "a@b.io" }).value).toStrictEqual(
    { id: 1, email: "a@b.io", role: "user" },
  );
  expect(user.validate({ id: 1, email: "a@b.io" }).value).toStrictEqual({
    id: 1,
    email: "a@b.io",
  });
});

test("jsonSchema - true and false schemas", () => {
  expect(accepts(true, { anything: 1 })).toStrictEqual(true);
  expect(accepts(false, 1)).toStrictEqual(false);
  const noExtra = {
    type: "object",
    properties: { a: { type: "number" }, legacy: false },
  } as const;
  expect(accepts(noExtra, { a: 1 })).toStrictEqual(true);
  expect(accepts(noExtra, { a: 1, legacy: "x" })).toStrictEqual(false);
});

test("jsonSchema - agrees with Ajv", () => {
  const schema = {
    $defs: {
      tag: { type: "string", pattern: "^[a-z]+$", minLength: 2 },
    },
    type: "object",
    properties: {
      id: {
        anyOf: [
          { type: "integer", exclusiveMinimum: 0 },
          {
            type: "string",
            format: "uuid",
          },
        ],
      },
      kind: { enum: ["a", "b", null] },
      version: { const: 2 },
      tags: {
        type: "array",
        items: { $ref: "#/$defs/tag" },
        uniqueItems: true,
        maxItems: 3,
      },
      point: {
        type: "array",
        prefixItems: [{ type: "number" }, { type: "number" }],
        items: false,
      },
      meta: { type: "object", additionalProperties: { type: "boolean" } },
      score: {
        oneOf: [
          { type: "number", multipleOf: 2 },
          {
            type: "number",
            multipleOf: 3,
          },
        ],
      },
      created: { type: "string", format: "date-time" },
      name: { type: ["string", "null"], maxLength: 5 },
    },
    required: ["id", "version"],
    additionalProperties: false,
  } as const;

  const samples = [
    { id: 1, version: 2 },
    { id: "00000000-0000-0000-0000-000000000000", version: 2, kind: null },
    { id: 0, version: 2 },
    { id: 1, version: 3 },
    { id: 1, version: 2, kind: "c" },
    { id: 1, version: 2, tags: ["ab", "cd"] },
    { id: 1, version: 2, tags: ["ab", "ab"] },
    { id: 1, version: 2, tags: ["a"] },
    { id: 1, version: 2, tags: ["ab", "cd", "ef", "gh"] },
    { id: 1, version: 2, point: [1, 2] },
    { id: 1, version: 2, point: [1, 2, 3] },
    { id: 1, version: 2, point: [1, "x"] },
    { id: 1, version: 2, meta: { a: true } },
    { id: 1, version: 2, meta: { a: 1 } },
    { id: 1, version: 2, score: 4 },
    { id: 1, version: 2, score: 6 },
    { id: 1, version: 2, score: 5 },
    { id: 1, version: 2, created: "2024-05-01T10:00:00Z" },
    { id: 1, version: 2, created: "yesterday" },
    { id: 1, version: 2, name: null },
    { id: 1, version: 2, name: "toolong" },
    { id: 1, version: 2, extra: true },
    { version: 2 },
    [],
  ];

  const validator = xoe.jsonSchema(schema);
  for (const sample of samples) {
    expect(
      validator.validate(sample).type === "success",
      JSON.stringify(sample),
    ).toStrictEqual(ajv.validate(schema, sample));
  }
});

test("jsonSchema - round trip keeps the meaning (checked with Ajv)", async () => {
  const { toJsonSchema } = await import("../../../index.ts");
  const schema = {
    type: "object",
    properties: {
      kind: { enum: ["a", "b"] },
      version: { const: 1 },
      score: {
        oneOf: [
          { type: "number", multipleOf: 2 },
          {
            type: "number",
            multipleOf: 3,
          },
        ],
      },
      both: {
        allOf: [
          { type: "string", minLength: 2 },
          {
            type: "string",
            maxLength: 4,
          },
        ],
      },
      day: { type: "string", format: "date" },
      price: { type: "number", exclusiveMinimum: 0 },
    },
    required: ["version"],
  } as const;
  const described = toJsonSchema(xoe.jsonSchema(schema));
  const samples = [
    { version: 1 },
    { version: 2 },
    { version: 1, kind: "c" },
    { version: 1, score: 6 },
    { version: 1, score: 4 },
    { version: 1, both: "a" },
    { version: 1, both: "abc" },
    { version: 1, day: "2024-01-01" },
    { version: 1, price: 0 },
  ];
  for (const sample of samples) {
    expect(
      ajv.validate(described, sample),
      JSON.stringify(sample),
    ).toStrictEqual(ajv.validate(schema, sample));
  }
});

test("jsonSchema - ipv4 and ipv6 formats", () => {
  const v4 = xoe.jsonSchema({ type: "string", format: "ipv4" });
  const v6 = xoe.jsonSchema({ type: "string", format: "ipv6" });
  expect(v4.validate("192.168.0.1").type).toStrictEqual("success");
  expect(v4.validate("::1").type).toStrictEqual("error");
  expect(v6.validate("::1").type).toStrictEqual("success");
  expect(v6.validate("192.168.0.1").type).toStrictEqual("error");
  for (const sample of ["192.168.0.1", "::1", "1.2.3", "2001:db8::1"]) {
    expect(v4.validate(sample).type === "success", sample).toStrictEqual(
      ajv.validate({ type: "string", format: "ipv4" }, sample),
    );
    expect(v6.validate(sample).type === "success", sample).toStrictEqual(
      ajv.validate({ type: "string", format: "ipv6" }, sample),
    );
  }
});
