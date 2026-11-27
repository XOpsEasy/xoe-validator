import { expect, test } from "vitest";
import xoe, { toFieldErrors, XOEValidationOutput } from "../../index.ts";

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const maliciousJson = '{"__proto__": {"isAdmin": true}}';

const assertSafeOutput = (output: unknown) => {
  const object = output as Record<string, unknown>;
  expect(Object.getPrototypeOf(object)).toStrictEqual(Object.prototype);
  expect(object.isAdmin).toStrictEqual(undefined);
  expect(({} as Record<string, unknown>).isAdmin).toStrictEqual(undefined);
};

test("own keys - record keeps __proto__ as a plain key", () => {
  const result = xoe
    .record(xoe.object({ isAdmin: xoe.boolean() }))
    .validate(JSON.parse(maliciousJson));

  expect(result.type).toStrictEqual("success");
  assertSafeOutput(result.value);
  expect(Object.keys(result.value)).toStrictEqual(["__proto__"]);
});

test("own keys - object passthrough keeps __proto__ as a plain key", () => {
  const result = xoe
    .object({ name: xoe.string().optional() })
    .passthrough()
    .validate(JSON.parse(maliciousJson));

  expect(result.type).toStrictEqual("success");
  assertSafeOutput(result.value);
});

test("own keys - object strips __proto__ by default", () => {
  const result = xoe
    .object({ name: xoe.string().optional() })
    .validate(JSON.parse(maliciousJson));

  expect(result.type).toStrictEqual("success");
  assertSafeOutput(result.value);
  expect(Object.keys(result.value)).toStrictEqual([]);
});

test("own keys - shape fields do not read inherited properties", () => {
  const schema = xoe.object({
    constructor: xoe.string(),
    toString: xoe.string().optional(),
  });

  // Compared as entries: toStrictEqual checks `.constructor`, which is a field here.
  expect(Object.entries(fieldErrors(schema.validate({})))).toStrictEqual([
    ["constructor", ["This field is required."]],
  ]);
});

test("own keys - strict reports keys that exist on Object.prototype", () => {
  const schema = xoe.object({ a: xoe.string() }).strict();

  expect(fieldErrors(schema.validate({ a: "x", toString: 1 }))).toStrictEqual({
    "": ["Unknown fields are not allowed. Allowed fields: a."],
  });
});

test("own keys - requireOne ignores inherited properties", () => {
  const schema = xoe
    .object({ constructor: xoe.string().optional() })
    .requireOne();

  expect(schema.validate({}).type).toStrictEqual("error");
});

test("own keys - sameAs ignores inherited properties", () => {
  expect(
    xoe.string().optional().sameAs("constructor").validate(undefined, {
      data: {},
    }).type,
  ).toStrictEqual("success");
});

test("own keys - discriminator must be an own value", () => {
  const schema = xoe.discriminatedUnion("type", {
    toString: xoe.object({}),
  });

  expect(fieldErrors(schema.validate({}))).toStrictEqual({
    type: ["This field is required."],
  });
  expect(fieldErrors(schema.validate({ type: "constructor" }))).toStrictEqual({
    type: ["Invalid type. Expected one of: toString."],
  });
});

test("own keys - JSON Schema required ignores inherited properties", () => {
  const schema = xoe.jsonSchema({ type: "object", required: ["toString"] });

  expect(fieldErrors(schema.validate({}))).toStrictEqual({
    toString: ["This field is required."],
  });
  expect(schema.validate({ toString: 1 }).type).toStrictEqual("success");
});

test("own keys - uniqueBy only reads own properties", () => {
  expect(
    xoe
      .array()
      .uniqueBy("constructor")
      .validate([{ a: 1 }, { a: 2 }]).type,
  ).toStrictEqual("error");
  expect(
    xoe
      .array()
      .uniqueBy("id")
      .validate([{ id: 1 }, { id: 2 }]).type,
  ).toStrictEqual("success");
});
