// Regression tests for problems an independent review found in the first
// version of the fixes for the November 2026 code review.
import { expect, test } from "vitest";
import xoe, {
  arrayRules,
  createRule,
  defineValidator,
  RefineOptions,
  toJsonSchema,
  XOEValidationOutput,
} from "../../index.ts";
import { deepEqual } from "../deepEqual.ts";
import { expectedSuccess } from "./helpers.ts";

const codes = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error"
    ? result.value.map((issue) => `${issue.path.join(".")}:${issue.code}`)
    : [];

test("array maxLength still runs on validators without nested values", () => {
  const list = defineValidator({
    type: "list",
    check: (value): value is unknown[] => Array.isArray(value),
    rules: arrayRules,
  });

  expect(codes(list().maxLength(2).validate([1, 2, 3]))).toStrictEqual([
    ":array.maxLength",
  ]);
  expect(
    codes(
      xoe.instanceOf(Array).with(arrayRules.maxLength(2)).validate([1, 2, 3]),
    ),
  ).toStrictEqual([":array.maxLength"]);
  expect(list().maxLength(2).validate([1, 2]).type).toStrictEqual("success");
});

test("jsonSchema allOf keeps nested defaults of every part", () => {
  const spec = {
    $defs: {
      Base: {
        type: "object",
        properties: {
          id: { type: "integer" },
          settings: {
            type: "object",
            properties: {
              theme: { type: "string", default: "light" },
              pageSize: { type: "integer", default: 20 },
            },
          },
        },
      },
    },
    allOf: [
      { $ref: "#/$defs/Base" },
      {
        type: "object",
        properties: { role: { type: "string", default: "user" } },
      },
    ],
  } as const;
  const user = xoe.jsonSchema(spec, { useDefaults: true });

  expect(user.validate({ id: 1, settings: {} })).toStrictEqual(
    expectedSuccess({
      id: 1,
      settings: { theme: "light", pageSize: 20 },
      role: "user",
    }),
  );
  expect(user.validate({ id: 1, settings: { theme: "dark" } })).toStrictEqual(
    expectedSuccess({
      id: 1,
      settings: { theme: "dark", pageSize: 20 },
      role: "user",
    }),
  );
});

test("requiredFields() still rejects null on optional wrapper fields", () => {
  const form = xoe
    .object({
      a: xoe
        .string()
        .optional()
        .transform((text) => text),
      b: xoe.lazy(() => xoe.string().optional()),
    })
    .requiredFields();

  expect(codes(form.validate({ a: null, b: null }))).toStrictEqual([
    "a:required",
    "b:required",
  ]);
  expect(form.validate({ a: "x", b: "y" })).toStrictEqual(
    expectedSuccess({
      a: "x",
      b: "y",
    }),
  );
});

test("refine accepts a message-or-options argument", () => {
  const forward = (options?: string | RefineOptions) =>
    xoe.string().refine((value) => value.length > 1, options);

  expect(codes(forward("Too short").validate("a"))).toStrictEqual([":custom"]);
  expect(codes(forward({ code: "short" }).validate("a"))).toStrictEqual([
    ":short",
  ]);
});

test("discriminatedUnion options that strip or pass keys still see the key", () => {
  const union = xoe.discriminatedUnion("type", {
    card: xoe.object({
      number: xoe
        .string()
        .refine((_value, data) => data?.type === "card", "needs type"),
    }),
    open: xoe
      .object({ note: xoe.string() })
      .passthrough()
      .refine((value) => (value as Record<string, unknown>).type === "open"),
  });

  expect(union.validate({ type: "card", number: "1" }).type).toStrictEqual(
    "success",
  );
  expect(
    union.validate({ type: "open", note: "x", extra: 1 }).type,
  ).toStrictEqual("success");
});

test("deepEqual: a failed Set probe doesn't make a pair equal later", () => {
  const p = { a: 1 };
  const w = { a: 1 };
  const z = { b: 2 };
  const r = { b: 2 };
  const left = [new Set([p, z]), p];
  const right = [new Set([r, w]), r];

  expect(deepEqual(left, right)).toStrictEqual(false);
  expect(
    codes(
      xoe
        .object({ x: xoe.unknown(), y: xoe.unknown().sameAs("x") })
        .validate({ x: left, y: right }),
    ),
  ).toStrictEqual(["y:sameAs"]);
});

test("issue params are plain objects, as before", () => {
  const result = xoe.object({ a: xoe.string().minLength(3) }).validate({
    a: "x",
  });
  const params = result.type === "error" ? result.value[0].params : undefined;

  expect(Object.isFrozen(params)).toStrictEqual(false);
});

test("a rule message getter is read on every validation", () => {
  let lang = "en";
  const rule = createRule<string>({
    code: "c",
    get message() {
      return lang === "en" ? "Bad" : "Loše";
    },
    check: () => false,
  });
  const value = xoe.string().with(rule);

  lang = "sr";
  const result = value.validate("x");
  expect(result.type === "error" && result.value[0].message).toStrictEqual(
    "Loše",
  );
});

test("toJsonSchema gives every place of a shared lazy its own schema", () => {
  const address = xoe.lazy(() => xoe.object({ street: xoe.string() }));
  const schema = toJsonSchema(xoe.object({ home: address, work: address }));
  const properties = schema.properties as Record<string, object>;

  expect(properties.home).toStrictEqual(properties.work);
  expect(properties.home === properties.work).toStrictEqual(false);
});

test("default() and catch() still copy binary data and errors", () => {
  const buffer = xoe
    .object({ b: xoe.unknown() })
    .default({
      b: new ArrayBuffer(4),
    })
    .validate(undefined);
  expect(
    buffer.type === "success" && buffer.value.b instanceof ArrayBuffer,
  ).toStrictEqual(true);

  const error = xoe
    .object({ e: xoe.unknown() })
    .default({
      e: new TypeError("x"),
    })
    .validate(undefined);
  expect(
    error.type === "success" && error.value.e instanceof TypeError,
  ).toStrictEqual(true);
});

test("date rules still take a timestamp from JavaScript callers", () => {
  const before = xoe.date().isBefore(1_700_000_000_000 as unknown as Date);

  expect(before.validate(new Date(0)).type).toStrictEqual("success");
  expect(before.validate(new Date(1_800_000_000_000)).type).toStrictEqual(
    "error",
  );
});

test("pipe still runs the next validator for undefined from a transform", () => {
  const name = xoe
    .string()
    .transform((text) => text.trim() || undefined)
    .pipe(xoe.string().default("anon"));
  const display = xoe
    .unknown()
    .transform((value) => (value as { name?: string }).name)
    .pipe(xoe.string().minLength(2));

  expect(name.validate("   ")).toStrictEqual(expectedSuccess("anon"));
  expect(codes(display.validate({}))).toStrictEqual([":required"]);
});

test("OpenAPI 3.0 nullable unions stay one anyOf", () => {
  expect(
    toJsonSchema(xoe.union([xoe.string(), xoe.number()]).nullable(), {
      target: "openapi-3.0",
    }),
  ).toStrictEqual({
    anyOf: [{ type: "string" }, { type: "number" }, { enum: [null] }],
  });
});
