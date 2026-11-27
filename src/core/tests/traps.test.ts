import { expect, test } from "vitest";
import xoe, {
  toFieldErrors,
  XOEUsageError,
  XOEValidationOutput,
} from "../../index.ts";

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const usageCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof XOEUsageError) return error.code;
    throw error;
  }
  return "no error";
};

test("jsonSchema - a type array is a union", () => {
  const nullableName = xoe.jsonSchema({
    type: ["string", "null"],
    minLength: 2,
  });

  expect(nullableName.validate("Jo").type).toStrictEqual("success");
  expect(nullableName.validate(null).type).toStrictEqual("success");
  expect(fieldErrors(nullableName.validate(123))).toStrictEqual({
    "": ["Value doesn't match any of the allowed types."],
  });
  expect(nullableName.validate("J").type).toStrictEqual("error");

  const item = xoe.jsonSchema({
    type: "object",
    properties: { note: { type: ["string", "null"] } },
  });
  expect(item.validate({ note: null }).type).toStrictEqual("success");
  expect(item.validate({ note: 1 }).type).toStrictEqual("error");
});

test("jsonSchema - unknown or empty types are rejected when built", () => {
  expect(
    usageCode(() => xoe.jsonSchema(JSON.parse('{"type":"strng"}'))),
  ).toStrictEqual("INVALID_SCHEMA");
  expect(
    usageCode(() => xoe.jsonSchema(JSON.parse('{"type":[]}'))),
  ).toStrictEqual("INVALID_SCHEMA");
  expect(
    usageCode(() =>
      xoe.jsonSchema(
        JSON.parse('{"type":"object","properties":{"a":{"type":"int"}}}'),
      ),
    ),
  ).toStrictEqual("INVALID_SCHEMA");
  // Without a type a schema accepts any value, as in JSON Schema.
  expect(xoe.jsonSchema({}).validate(123).type).toStrictEqual("success");
});

test("default and catch - objects are not shared between validations", () => {
  const settings = xoe.object({ tags: xoe.array(xoe.string()) }).catch({
    tags: ["default"],
  });
  const first = settings.validate("invalid").value as { tags: string[] };
  first.tags.push("leaked");
  expect(settings.validate("invalid").value).toStrictEqual({
    tags: ["default"],
  });

  const meta = xoe.object().default({ created: new Date(0) });
  const created = (meta.validate(undefined).value as { created: Date }).created;
  created.setFullYear(2030);
  expect(meta.validate(undefined).value).toStrictEqual({
    created: new Date(0),
  });
});

test("default and catch - the value passed in is not changed or shared", () => {
  const fallback = { theme: "light" };
  const settings = xoe.object({ theme: xoe.string() }).catch(fallback);
  (settings.validate(1).value as { theme: string }).theme = "dark";

  expect(fallback).toStrictEqual({ theme: "light" });
  fallback.theme = "changed later";
  expect(settings.validate(1).value).toStrictEqual({ theme: "light" });
});

test("default and catch - values that can't be copied need a function", () => {
  expect(
    usageCode(() => xoe.object().default({ format: () => "x" })),
  ).toStrictEqual("UNCOPYABLE_VALUE");
  // Class instances are not copied (a copy would lose the prototype).
  const origin = new URL("https://example.com");
  expect(
    xoe.instanceOf(URL).default(origin).validate(undefined).value,
  ).toStrictEqual(origin);
});

test("object and array without a shape return a copy", () => {
  const input = { a: 1, nested: { b: 2 } };
  const output = xoe.object().validate(input).value as Record<string, unknown>;
  output.a = 99;

  expect(output === input).toStrictEqual(false);
  expect(input.a).toStrictEqual(1);
  expect(output.nested === input.nested).toStrictEqual(true); // shallow copy

  const list = [1, 2];
  const copy = xoe.array().validate(list).value as number[];
  copy.push(3);
  expect([copy === list, list]).toStrictEqual([false, [1, 2]]);
});

test("object without a shape keeps rules and refinements", () => {
  const value = xoe.object().refine((object) => typeof object.id === "number", {
    message: "id must be a number",
    path: ["id"],
  });

  expect(value.validate({ id: 1, extra: true })).toStrictEqual({
    type: "success",
    value: { id: 1, extra: true },
  });
  expect(fieldErrors(value.validate({ id: "1" }))).toStrictEqual({
    id: ["id must be a number"],
  });
});

test("lazy - the getter runs once", () => {
  let calls = 0;
  const point = xoe.lazy(() => {
    calls++;
    return xoe.object({ x: xoe.number() });
  });

  for (let i = 0; i < 5; i++) point.validate({ x: 1 });
  expect(point.isAsync).toStrictEqual(false);
  expect(calls).toStrictEqual(1);
});

test("lazy - a getter that throws before its reference exists is retried", () => {
  let ready = false;
  const value = xoe.lazy(() => {
    if (!ready) throw new Error("not defined yet");
    return xoe.string();
  });

  expect(() => value.validate("x")).toThrow("not defined yet");
  ready = true;
  expect(value.validate("x").type).toStrictEqual("success");
});

test("coerce.date - days that don't exist are invalid", () => {
  const date = xoe.coerce.date();

  for (const missing of [
    "2024-02-30",
    "2023-02-29",
    "2024-04-31",
    "2024-00-10",
    "2024-13-01",
    "2024-02-30T10:00",
  ]) {
    expect(fieldErrors(date.validate(missing)), missing).toStrictEqual({
      "": ["Value must be a valid date."],
    });
  }
  for (const existing of [
    "2024-02-29",
    "2024-12-31",
    "2024-02-28T23:59:59Z",
    " 2024-01-01 ",
  ]) {
    expect(date.validate(existing).type, existing).toStrictEqual("success");
  }
  expect(date.validate(0).type).toStrictEqual("success");
});

test("discriminatedUnion - numeric discriminators", () => {
  const event = xoe.discriminatedUnion("version", {
    1: xoe.object({ name: xoe.string() }),
    2: xoe.object({ title: xoe.string() }),
  });

  expect(event.validate({ version: 1, name: "a" })).toStrictEqual({
    type: "success",
    value: { version: 1, name: "a" },
  });
  expect(event.validate({ version: "2", title: "b" })).toStrictEqual({
    type: "success",
    value: { version: "2", title: "b" },
  });
  expect(fieldErrors(event.validate({ version: 3 }))).toStrictEqual({
    version: ["Invalid version. Expected one of: 1, 2."],
  });
  expect(fieldErrors(event.validate({ version: true }))).toStrictEqual({
    version: ["Invalid version. Expected one of: 1, 2."],
  });

  type Event = typeof event extends { "~standard": { types?: infer T } }
    ? NonNullable<T> extends { output: infer O }
      ? O
      : never
    : never;
  const types: [
    Equal<
      Event,
      { version: 1 | "1"; name: string } | { version: 2 | "2"; title: string }
    >,
  ] = [true];
  expect(types).toStrictEqual([true]);
});

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

test("record - keys that collide after a transform are reported", () => {
  const prices = xoe.record(xoe.string().trim(), xoe.number());

  expect(prices.validate({ " a": 1, "a ": 2, b: 3 })).toStrictEqual({
    type: "error",
    value: [
      {
        code: "record.duplicateKey",
        message: 'Key "a" is used more than once.',
        params: { key: "a", first: " a" },
        path: ["a "],
      },
    ],
  });
  expect(prices.validate({ " a": 1, b: 3 })).toStrictEqual({
    type: "success",
    value: { a: 1, b: 3 },
  });
});

test("record - duplicate keys with async validators keep the input order", async () => {
  const keys = xoe
    .string()
    .trim()
    .refineAsync(() => Promise.resolve(true));
  const result = await xoe.record(keys, xoe.number()).validateAsync({
    "x ": 1,
    " x": 2,
  });

  expect(
    result.type === "error" &&
      result.value.map(({ path, params }) => [path, params]),
  ).toStrictEqual([[[" x"], { key: "x", first: "x " }]]);
});
