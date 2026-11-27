import { expect, test } from "vitest";
import xoe, {
  localizeIssues,
  toFieldErrors,
  XOEValidationOutput,
} from "../../../index.ts";
import { expectedSuccess } from "../../../core/tests/helpers.ts";

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

test("jsonSchema - primitive types use the xoe issues", () => {
  expect(xoe.jsonSchema({ type: "string" }).validate("ok").type).toStrictEqual(
    "success",
  );
  expect(xoe.jsonSchema({ type: "number" }).validate("1")).toStrictEqual({
    type: "error",
    value: [
      {
        code: "type",
        message: "Value must be a number.",
        params: { expected: "number", received: "string" },
        path: [],
      },
    ],
  });
  expect(
    xoe.jsonSchema({ type: "boolean" }).validate(false).type,
  ).toStrictEqual("success");
  expect(xoe.jsonSchema({ type: "null" }).validate(null).type).toStrictEqual(
    "success",
  );
  expect(
    fieldErrors(xoe.jsonSchema({ type: "null" }).validate(0)),
  ).toStrictEqual({
    "": ["Value must be null."],
  });
});

test("jsonSchema - string, number and integer keywords", () => {
  const name = xoe.jsonSchema({ type: "string", minLength: 2, maxLength: 4 });
  expect(fieldErrors(name.validate("a"))).toStrictEqual({
    "": ["Must be at least 2 characters long."],
  });
  expect(fieldErrors(name.validate("abcde"))).toStrictEqual({
    "": ["Must be at most 4 characters long."],
  });

  const age = xoe.jsonSchema({ type: "integer", minimum: 0, maximum: 120 });
  expect(age.validate(30)).toStrictEqual(expectedSuccess(30));
  const fraction = age.validate(1.5);
  expect(
    fraction.type === "error" && fraction.value.map((issue) => issue.code),
  ).toStrictEqual(["number.integer"]);
  expect(fieldErrors(age.validate(-1))).toStrictEqual({
    "": ["Must be greater than or equal to 0."],
  });
});

test("jsonSchema - empty string and null are values", () => {
  const schema = xoe.jsonSchema({
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string" },
      nickname: { type: "string", minLength: 1 },
      age: { type: "number" },
    },
  });

  expect(schema.validate({ name: "" })).toStrictEqual(
    expectedSuccess({ name: "" }),
  );
  expect(
    fieldErrors(schema.validate({ name: "x", nickname: "" })),
  ).toStrictEqual({
    nickname: ["Must be at least 1 character long."],
  });
  expect(fieldErrors(schema.validate({ name: "x", age: null }))).toStrictEqual({
    age: ["Value must be a number."],
  });
  expect(fieldErrors(schema.validate({ name: null }))).toStrictEqual({
    name: ["Value must be text."],
  });
});

test("jsonSchema - required and optional properties", () => {
  const schema = xoe.jsonSchema({
    type: "object",
    required: ["id", "meta"],
    properties: {
      id: { type: "integer" },
      title: { type: "string" },
    },
  });

  expect(fieldErrors(schema.validate({}))).toStrictEqual({
    id: ["This field is required."],
    meta: ["This field is required."],
  });
  expect(schema.validate({ id: 1, meta: { any: "value" } }).type).toStrictEqual(
    "success",
  );
});

test("jsonSchema - additional properties", () => {
  const open = xoe.jsonSchema({
    type: "object",
    properties: { name: { type: "string" } },
  });
  expect(open.validate({ name: "a", extra: true })).toStrictEqual(
    expectedSuccess({ name: "a", extra: true }),
  );

  const closed = xoe.jsonSchema({
    type: "object",
    properties: { name: { type: "string" } },
    additionalProperties: false,
  });
  expect(
    fieldErrors(closed.validate({ name: "a", extra: true })),
  ).toStrictEqual({
    "": ["Unknown fields are not allowed. Allowed fields: name."],
  });
});

test("jsonSchema - nested objects and arrays report paths", () => {
  const schema = xoe.jsonSchema({
    type: "object",
    required: ["user"],
    properties: {
      user: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", minLength: 3 } },
      },
      tags: { type: "array", items: { type: "string" } },
    },
  });

  expect(
    fieldErrors(schema.validate({ user: { email: "a" }, tags: ["x", 1] })),
  ).toStrictEqual({
    "user.email": ["Must be at least 3 characters long."],
    "tags.1": ["Value must be text."],
  });
});

test("jsonSchema - a schema without type accepts any value", () => {
  const anything = xoe.jsonSchema({});

  for (const value of ["a", 1, null, {}, []]) {
    expect(anything.validate(value).type).toStrictEqual("success");
  }
});

test("jsonSchema - works inside xoe schemas and with localizeIssues", async () => {
  const form = xoe.object({
    name: xoe.string(),
    settings: xoe.jsonSchema({
      type: "object",
      properties: { theme: { type: "string" } },
    }),
  });

  expect(
    fieldErrors(form.validate({ name: "", settings: { theme: 1 } })),
  ).toStrictEqual({
    name: ["This field is required."],
    "settings.theme": ["Value must be text."],
  });
  expect(
    (await form.validateAsync({ name: "x", settings: { theme: "" } })).type,
  ).toStrictEqual("success");

  const result = xoe.jsonSchema({ type: "string" }).validate(1);
  expect(
    result.type === "error" &&
      localizeIssues(result.value, { type: "Pogrešan tip." })[0].message,
  ).toStrictEqual("Pogrešan tip.");
});
